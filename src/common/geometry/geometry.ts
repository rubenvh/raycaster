import { IBSPNode } from './bsp/model';
import { selectPolygon } from './../selection/selectable';

import * as vector from '../math/vector';
import * as collision from './collision';
import { IEdge, cloneEdge, duplicateEdge, makeEdge, createEdges, loadEdge } from './edge';
import { IEntity, giveIdentity, IEntityKey, createEntityKey, cloneKey } from './entity';
import { BoundingBox, createPolygon, IPolygon, IStoredPolygon, loadPolygon, contains, containsVertex, containsEdge, centerOf, merge, storePolygon } from './polygon';
import { SelectableElement, selectEdge, selectVertex } from '../selection/selectable';
import { areEqual, IVertex, IVertexMap, makeVertex } from './vertex';
import { cloneMaterial } from './properties';

export type IStoredGeometry = IEntity & { polygons: IStoredPolygon[],bsp?: IBSPNode};
export type IGeometry = IEntity & { polygons: IPolygon[], bsp?: IBSPNode, edgeCount: number, bounds: vector.Vector};
export const EMPTY_GEOMETRY: IGeometry = {polygons: [], edgeCount: 0, bounds: [0,0]};
export const storeGeometry = (g: IGeometry): IStoredGeometry => ({id: g.id, polygons: g.polygons.map(storePolygon), bsp: g.bsp});
export const loadGeometry = (g : IStoredGeometry): IGeometry => {
    const polygons = g.polygons.map(loadPolygon);
    return ({id: g.id, polygons, edgeCount: countEdges(polygons), bounds: findBounds(polygons), bsp: g.bsp});
};
export const createGeometry = (polygonCollection: vector.Vector[][]): IGeometry => {
    const polygons = polygonCollection.map(createPolygon);
    return ({polygons, edgeCount: countEdges(polygons), bounds: findBounds(polygons)});
};
export const addPolygon = (p: IPolygon, geometry: IGeometry): IGeometry => ({...geometry, 
    polygons: [...geometry.polygons, p], edgeCount: geometry.edgeCount+1});
const countEdges = (ps : IPolygon[]): number => ps.reduce((acc, p) => acc + p.edgeCount, 0);
const findBounds = (ps : IPolygon[]): vector.Vector => ps.reduce((acc, p) => vector.maximumComponents(acc, p.boundingBox[1]), [0,0] as vector.Vector);
export const detectCollisionAt = (vector: vector.Vector, geometry: IGeometry): collision.Collision => {
    return collision.detectCollisionAt(vector, geometry.polygons);    
}

const forkPolygons = (ids: IEntityKey[], geometry: IGeometry, polygonSplitter: (poligon: IPolygon)=>IEdge[][]) : IGeometry => {
    
    let [unchanged, adapted]: [IPolygon[], IPolygon[]] = geometry.polygons.reduce((acc, p) => {
        acc[+ids.includes(p.id)].push(p);
        return acc;
    }, [[],[]]);

    let polygonIdsUsed = [];
    let adaptedPolygons = adapted
        .map(p => ({p, edgeSets: polygonSplitter(p)}))        
        .reduce((acc, _) => acc.concat(..._.edgeSets.map(s => {
            const key = (acc.some(p => p.id === _.p.id) || polygonIdsUsed.includes(_.p.id)) ? createEntityKey() : cloneKey(_.p.id);
            polygonIdsUsed.push(key);
            return loadPolygon({ id: key, edges: s});
        })), [] as IPolygon[]);

    const polygons = [...unchanged, ...adaptedPolygons];
    return ({...geometry, bsp: null, polygons, edgeCount: countEdges(polygons), bounds: findBounds(polygons)});
};

const adaptPolygons = (ids: IEntityKey[], geometry: IGeometry, edgeTransformer: (poligon: IPolygon)=>IEdge[]) => {    
    return forkPolygons(ids, geometry, (p)=>[edgeTransformer(p)]);    
};


export const splitEdge = (cut: vector.Vector, edge: IEdge, poligon: IEntityKey, geometry: IGeometry) => {
    return adaptPolygons([poligon], geometry, (selectedPolygon) => {
        return selectedPolygon.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            if (e.id === edge.id) {
                const newEnd = e.end;
                e.end = makeVertex(cut);
                const newEdge: IEdge = loadEdge({start: e.end, end: newEnd, immaterial: e.immaterial, material: cloneMaterial(e.material)});
                return acc.concat(e, newEdge);
            }
            return acc.concat(e);
        }, [])
    });
}

export const moveVertices = (isSnapping: boolean, delta: vector.Vector, map: IVertexMap, geometry: IGeometry): IGeometry => {
    const doSnap = (v: vector.Vector) => isSnapping ? vector.snap(v) : v;
    return adaptPolygons(Array.from(map.keys()), geometry, p => {
        const vertices = [...map.get(p.id)];
        const moveVertex = (v: IVertex) => {
            const index = vertices.findIndex(_ => _.id === v.id);
            if (index >= 0) { 
                vector.copyIn(v.vector, doSnap(vector.add(v.vector, delta)));
            }
        };
        return p.edges.map(e=>cloneEdge(e)).reduce((acc, e) => {
            moveVertex(e.start);
            moveVertex(e.end);            
            return acc.concat(e);
        }, [])
    });
};

export const removeVertex = (vertex: IVertex, poligon: IEntityKey, geometry: IGeometry) => {    
    const result = adaptPolygons([poligon], geometry, (selectedPolygon) => {
        const {edges} = selectedPolygon.edges.map(e=>cloneEdge(e)).reduce((acc, e)=> {                
            if (vertex.id === e.start.id && vertex.id === e.end.id) { // removing last vertex in an empty polygon
                return acc;
            } else if (e.end.id === vertex.id && acc.lastEnd) { // first vertex in polygon was removed and we arrive at the last edge
                e.end = acc.lastEnd;
                acc.edges.push(e);
            }
            else if (e.end.id === vertex.id) {  // edge end vertex is removed => store for next iteration to reassign end vertex 
                acc.previous = e;
                acc.edges.push(e);            
            } else if (acc.previous && e.start.id === vertex.id) { // ignore this edge and reassign previous end 
                acc.previous.end = e.end;            
            } else if (e.start.id === vertex.id) { // removing the start of the first edge, keep end until last edge
                acc.lastEnd = e.end;
            } else {
                acc.edges.push(e);
            }        
            return acc;  
            }, 
            {edges: [], previous: null as IEdge, lastEnd: null as IVertex})
        return edges;
    });

    return {...result, polygons: result.polygons.filter(_=>_.edgeCount > 0) };
};

export const selectRegion = (region: BoundingBox, geometry: IGeometry): SelectableElement[] => {
    const ps = geometry.polygons.filter(p => contains(region, p.boundingBox));
    const [vs, es] = geometry.polygons.filter(p => !ps.includes(p)).reduce((acc, p) => ([
        [...acc[0], ...p.vertices.filter(v => containsVertex(v, region)).map(v => selectVertex(v, p))],
        [...acc[1], ...p.edges.filter(v => containsEdge(v, region)).map(e => selectEdge(e, p))]]), [[], []]);

    return [...ps.map(p => selectPolygon(p)),
            ...es, ...vs,
    ];
};

export const duplicatePolygons = (poligons: IPolygon[], delta: vector.Vector, geometry: IGeometry): [IGeometry, IPolygon[]] => {
    const newPoligons = poligons.map(p => 
        loadPolygon(giveIdentity<IStoredPolygon>({edges: p.edges.map(e => duplicateEdge(e, delta))})));
    return [
        {...geometry, polygons: [...geometry.polygons, ...newPoligons]},
        newPoligons];
};

export const transformEdges = (edges: IEdge[], poligonId: IEntityKey, transformer: (_: IEdge) => IEdge, geometry: IGeometry): IGeometry => {
    return adaptPolygons([poligonId], geometry, p => p.edges
        .map(e => cloneEdge(e))
        .reduce((acc, e) => acc.concat(edges.some(_ => e.id === _.id) ? transformer(e) : e), []));
};

export const expandPolygon = (edge: IEdge, poligonId: IEntityKey, target: vector.Vector, geometry: IGeometry): [IPolygon, IGeometry] => {
    const result = adaptPolygons([poligonId], geometry, p => {
        const center = centerOf(p.boundingBox);        
        const centerToTarget = vector.distance(center, target);
        const centerToEdge = vector.distance(center, edge.start.vector);
        const delta = vector.subtract(edge.start.vector, target);

        const calcVector = (vertex: IVertex): vector.Vector => {
            const v = vector.scale(vector.norm(delta), vector.normalize(vector.subtract(vertex.vector, center)));            
            return centerToTarget < centerToEdge 
            ? vector.subtract(vertex.vector, v) 
            : vector.add(vertex.vector, v);
        }        
        const createEdge = (start: vector.Vector, end: vector.Vector, edge: IEdge): IEdge => ({
            ...makeEdge(start, end), material: cloneMaterial(edge.material),
        });
        return p.edges.map(e => cloneEdge(e)).reduce((acc, e, i, edges) => {
            if (e.id !== edge.id) return acc.concat(e);

            // walk reversely through edge list, creating new edges further away from center
            const expandedEdges = edges.slice(0, i).reverse().concat(edges.slice(i+1).reverse())
            .reduce(
                (acc, _, ix) => acc.concat(createEdge(acc[ix].end.vector, calcVector(_.start), _)), 
                [createEdge(e.start.vector, calcVector(e.start), e)]);

            return acc.concat(...expandedEdges.concat(createEdge(expandedEdges[expandedEdges.length-1].end.vector, e.end.vector, e)));
        }, []);
    });

    return [result.polygons.find(p => p.id === poligonId), result];    
}

export const rotatePolygon = (polygonIds: IEntityKey[], target: vector.Vector, geometry: IGeometry): IGeometry => {
    const polygons = geometry.polygons.filter(x => polygonIds.includes(x.id));
    const mergedBoundedBox = polygons.slice(1).reduce((acc, p) => merge(acc, p.boundingBox), polygons[0].boundingBox);
    const center = centerOf(mergedBoundedBox);     
    const reference = polygons[0].edges[0].start.vector;
    return adaptPolygons(polygonIds, geometry, p => {        
        const centerToTarget = vector.subtract(target, center);
        const centerToReference = vector.subtract(reference, center);
        const angle = -1 * vector.angleBetween(centerToTarget, centerToReference);
        const edges = createEdges(p.vertices
                .map(v => vector.subtract(v.vector, center))
                .map(u => vector.add(center, vector.rotate(angle, u))));
        return edges
            .map((e, i) => ({newEdge: e, basedOn: p.edges[i] }))
            .map(_ => ({..._.newEdge, immaterial: _.basedOn?.immaterial ?? false, material: _.basedOn && cloneMaterial(_.basedOn.material) || _.newEdge.material }));;
    });
}

export const splitPolygon = (v1: IVertex, v2: IVertex, poligonId: IEntityKey, geometry: IGeometry): IGeometry => {
    const result = forkPolygons([poligonId], geometry, p => {   
        // find indices of splitting vertices
        let i = p.vertices.findIndex(v => areEqual(v, v1));
        let j = p.vertices.findIndex(v => areEqual(v, v2));

        // make sure they are in small to large order
        if (i > j) {
            const temp = i;
            i = j;
            j = temp;
        }

        // utility function to create edges (copying material) for a list of vertices
        const create = (vs: IVertex[]): IEdge[] => createEdges(vs.map(v => v.vector))
            .map(e => ({newEdge: e, basedOn: p.edges.find(_ => areEqual(_.start, e.start)) }))
            .map(_ => ({..._.newEdge, immaterial: _.basedOn?.immaterial ?? false, material: _.basedOn && cloneMaterial(_.basedOn.material) || _.newEdge.material }));
        
        // create 2 new polygons and return them
        const p1 = create(p.vertices.slice(0, i+1).concat(p.vertices.slice(j)));
        const p2 = create(p.vertices.slice(i, j+1));
        return [p1, p2];
    });

    return result;   
}

export const reversePolygon = (polygonIds: IEntityKey[], geometry: IGeometry): IGeometry => {    
    return adaptPolygons(polygonIds, geometry, p => {        
        const edges = createEdges([p.vertices[0], ...p.vertices.slice(1).reverse()]
                .map(v => v.vector));
        return edges
            .map((e, i) => ({newEdge: e, basedOn: p.edges[p.edges.length-(i+1)] }))
            .map(_ => ({..._.newEdge, immaterial: _.basedOn?.immaterial ?? false, material: _.basedOn && cloneMaterial(_.basedOn.material) || _.newEdge.material }));;
    });
}

export const queryVertex = (vertexId : IEntityKey, polygonId: IEntityKey, geometry: IGeometry): IVertex => {
    return geometry.polygons.find(_ => _.id === polygonId).vertices.find(_ => _.id === vertexId);
}
export const queryEdge = (edgeId : IEntityKey, polygonId: IEntityKey, geometry: IGeometry): IEdge => {
    return geometry.polygons.find(_ => _.id === polygonId).edges.find(_ => _.id === edgeId);
}
export const queryPolygon = (polygonId: IEntityKey, geometry: IGeometry): IPolygon => {
    return geometry.polygons.find(_ => _.id === polygonId);
}