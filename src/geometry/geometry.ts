

import { Guid } from 'guid-typescript';
import * as vector from '../math/vector';
import * as collision from './collision';
import { IEdge, cloneEdge, duplicateEdge, makeEdge, createEdges } from './edge';
import { IEntity, giveIdentity } from './entity';
import { BoundingBox, createPolygon, IPolygon, IStoredPolygon, loadPolygon, contains, containsVertex, containsEdge, centerOf, merge } from './polygon';
import { SelectableElement, SelectedEdge, SelectedPolygon, SelectedVertex } from './selectable';
import { areEqual, IVertex, makeVertex } from './vertex';
import { cloneMaterial } from './properties';

export type IStoredGeometry = IEntity & { polygons: IStoredPolygon[]};
export type IGeometry = { polygons: IPolygon[]};


export const loadGeometry = (geometry : IStoredGeometry): IGeometry => ({polygons: geometry.polygons.map(loadPolygon)});
export const createGeometry = (polygonCollection: vector.Vector[][]): IGeometry => ({polygons: polygonCollection.map(createPolygon)});
export const addPolygon = (p: IPolygon, geometry: IGeometry): IGeometry => ({polygons: [...geometry.polygons, p]});

export const detectCollisionAt = (vector: vector.Vector, geometry: IGeometry): collision.Collision => {
    return collision.detectCollisionAt(vector, geometry.polygons);    
}

export const detectCollisions = (ray: collision.IRay, geometry: IGeometry): collision.RayCollisions => {
    return collision.detectCollisions(ray, geometry.polygons);
}

const forkPolygons = (ids: Guid[], geometry: IGeometry, polygonSplitter: (poligon: IPolygon)=>IEdge[][]) : IGeometry => {
    
    let [unchanged, adapted]: [IPolygon[], IPolygon[]] = geometry.polygons.reduce((acc, p) => {
        acc[+ids.includes(p.id)].push(p);
        return acc;
    }, [[],[]]);

    let adaptedPolygons = adapted
        .map(p => ({p, edgeSets: polygonSplitter(p)}))        
        .reduce((acc, _, i) => acc.concat(..._.edgeSets.map(s => loadPolygon({id: acc.some(p => p.id === _.p.id) ? Guid.create(): _.p.id, edges: s}))), [] as IPolygon[]);

    return ({...geometry, polygons: [...unchanged, ...adaptedPolygons]});
};

const adaptPolygons = (ids: Guid[], geometry: IGeometry, edgeTransformer: (poligon: IPolygon)=>IEdge[]) => {    
    return forkPolygons(ids, geometry, (p)=>[edgeTransformer(p)]);    
};


export const splitEdge = (cut: vector.Vector, edge: IEdge, poligon: IPolygon, geometry: IGeometry) => {
    return adaptPolygons([poligon.id], geometry, (selectedPolygon) => {
        return selectedPolygon.edges.map(cloneEdge).reduce((acc, e) => {
            if (e.id === edge.id) {
                const newEnd = e.end;
                e.end = makeVertex(cut);
                const newEdge: IEdge = {start: e.end, end: newEnd, immaterial: e.immaterial, material: {color: [...e.material.color]}};
                return acc.concat(e, newEdge);
            }
            return acc.concat(e);
        }, [])
    });
}

export const moveVertices = (isSnapping: boolean, delta: vector.Vector, map: Map<Guid, IVertex[]>, geometry: IGeometry): IGeometry => {
    const doSnap = (v: vector.Vector) => isSnapping ? vector.snap(v) : v;
    return adaptPolygons(Array.from(map.keys()), geometry, p => {
        const vertices = [...map.get(p.id)];
        const moveVertex = (v: IVertex) => {
            const index = vertices.findIndex(_ => _.id === v.id);
            if (index >= 0) { 
                vector.copyIn(v.vector, doSnap(vector.add(v.vector, delta)));
            }
        };
        return p.edges.map(cloneEdge).reduce((acc, e) => {
            moveVertex(e.start);
            moveVertex(e.end);            
            return acc.concat(e);
        }, [])
    });
};

export const removeVertex = (vertex: IVertex, poligon: IPolygon, geometry: IGeometry) => {    
    return adaptPolygons([poligon.id], geometry, (selectedPolygon) => {
        const {edges} = selectedPolygon.edges.map(cloneEdge).reduce((acc, e)=> {                
            if (e.end.id === vertex.id && acc.lastEnd) { // first vertex in polygon was removed and we arrive at the last edge
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
};

export const selectRegion = (region: BoundingBox, geometry: IGeometry): SelectableElement[] => {
    const ps = geometry.polygons.filter(p => contains(region, p.boundingBox));
    const [vs, es] = geometry.polygons.filter(p => !ps.includes(p)).reduce((acc, p) => ([
        [...acc[0], ...p.vertices.filter(v => containsVertex(v, region)).map(v => ({kind: 'vertex', vertex: v, polygon: p} as SelectedVertex))],
        [...acc[1], ...p.edges.filter(v => containsEdge(v, region)).map(e => ({kind: 'edge', edge: e, polygon: p} as SelectedEdge))]]), [[], []]);

    return [...ps.map(p => ({kind: 'polygon', polygon: p} as SelectedPolygon)),
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

export const transformEdges = (edges: IEdge[], poligonId: Guid, transformer: (_: IEdge) => IEdge, geometry: IGeometry): IGeometry => {
    return adaptPolygons([poligonId], geometry, p => p.edges
        .map(cloneEdge)
        .reduce((acc, e) => acc.concat(edges.some(_ => e.id === _.id) ? transformer(e) : e), []));
};

export const expandPolygon = (edge: IEdge, poligonId: Guid, target: vector.Vector, geometry: IGeometry): [IPolygon, IGeometry] => {
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
        return p.edges.map(cloneEdge).reduce((acc, e, i, edges) => {
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

export const rotatePolygon = (polygonIds: Guid[], target: vector.Vector, geometry: IGeometry): IGeometry => {
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

export const splitPolygon = (v1: IVertex, v2: IVertex, poligonId: Guid, geometry: IGeometry): IGeometry => {
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
