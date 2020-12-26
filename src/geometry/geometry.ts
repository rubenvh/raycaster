
import { Guid } from 'guid-typescript';
import * as vector from '../math/vector';
import * as collision from './collision';
import { IEdge, cloneEdge, duplicateEdge } from './edge';
import { IEntity, giveIdentity } from './entity';
import { BoundingBox, createPolygon, IPolygon, IStoredPolygon, loadPolygon, contains, containsVertex, containsEdge } from './polygon';
import { SelectableElement, SelectedEdge, SelectedPolygon, SelectedVertex } from './selectable';
import { cloneVertex, IVertex, makeVertex } from './vertex';


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

const adaptPolygons = (ids: Guid[], geometry: IGeometry, edgeTransformer: (poligon: IPolygon)=>IEdge[]) => {
    
    let [unchanged, adapted] = geometry.polygons.reduce((acc, p) => {
        acc[+ids.includes(p.id)].push(p);
        return acc;
    }, [[],[]]);

    let adaptedPolygons = adapted.map(p => ({p, edges: edgeTransformer(p)}))
        .filter(_ => _.edges.length >= 2)
        .map(_ => loadPolygon({id: _.p.id, edges: _.edges}));

    return ({...geometry, polygons: [...unchanged, ...adaptedPolygons]});
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
}

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
}

export const selectRegion = (region: BoundingBox, geometry: IGeometry): SelectableElement[] => {
    const ps = geometry.polygons.filter(p => contains(region, p.boundingBox));
    const [vs, es] = geometry.polygons.filter(p => !ps.includes(p)).reduce((acc, p) => ([
        [...acc[0], ...p.vertices.filter(v => containsVertex(v, region)).map(v => ({kind: 'vertex', vertex: v, polygon: p} as SelectedVertex))],
        [...acc[1], ...p.edges.filter(v => containsEdge(v, region)).map(e => ({kind: 'edge', edge: e, polygon: p} as SelectedEdge))]]), [[], []]);

    return [...ps.map(p => ({kind: 'polygon', polygon: p} as SelectedPolygon)),
            ...es, ...vs,
    ];
}

export const duplicatePolygons = (poligons: IPolygon[], delta: vector.Vector, geometry: IGeometry): [IGeometry, IPolygon[]] => {
    const newPoligons = poligons.map(p => 
        loadPolygon(giveIdentity<IStoredPolygon>({edges: p.edges.map(e => duplicateEdge(e, delta))})));
    return [
        {...geometry, polygons: [...geometry.polygons, ...newPoligons]},
        newPoligons];
}
