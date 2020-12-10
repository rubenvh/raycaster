
import { Guid } from 'guid-typescript';
import { intersectRay, IRay, distanceToMidPoint } from './lineSegment';
import * as vector from './vector';
import { IGeometry, IVertex, distance, IPolygon, loadPolygon, createPolygon, IStoredGeometry, IEdge, makeVertex, segmentFrom, hasIntersect } from './vertex';
const R = require('ramda')

export type Collision = {polygon: IPolygon, distance: number, kind: string};
export type VertexCollision = Collision & { vertex: IVertex, kind: "vertex"};
export type EdgeCollision = Collision & {edge: IEdge, kind: "edge" };
export type RayHit = {polygon: IPolygon, edge: IEdge, intersection: vector.Vector, ray: IRay, distance: number};
export type IntersectionStats = {percentage: number, amount: number };
export type RayCollisions = {hits: RayHit[], stats: IntersectionStats};


export const loadGeometry = (geometry : IStoredGeometry): IGeometry => ({polygons: geometry.polygons.map(loadPolygon)});
export const createGeometry = (polygonCollection: vector.Vector[][]): IGeometry => ({polygons: polygonCollection.map(createPolygon)});
export const addPolygon = (p: IPolygon, geometry: IGeometry): IGeometry => ({polygons: [...geometry.polygons, p]});

export const detectCollisionAt = (vector: vector.Vector, geometry: IGeometry): VertexCollision|EdgeCollision => {
    const distanceComparer = (x: {distance:number}, y: {distance:number}) => x.distance - y.distance;
        return geometry.polygons.reduce((acc, p) => {            
            let edges: Collision[] = p.edges
                .map(e => ({polygon: p, kind: "edge", edge: e, distance: distanceToMidPoint(vector, segmentFrom(e))} as const));
            let vertices: Collision[] = p.vertices
            .map(v => ({ polygon: p, kind: "vertex", vertex: v, distance: distance(v, vector)} as const));

            let closest = edges.concat(vertices)                
            .filter(_ => _.distance <= 50)
            .sort(distanceComparer)[0];
            return closest ? acc.concat(closest) : acc;
        }, [])
        .sort(distanceComparer)[0];
} 

const adaptPolygons = (ids: Guid[], geometry: IGeometry, edgeTransformer: (poligon: IPolygon)=>IEdge[]) => {
    
    let [unchanged, adapted] = geometry.polygons.reduce((acc, p) => {
        acc[+ids.includes(p.id)].push(p);
        return acc;
    }, [[],[]]);

    let adaptedPolygons = adapted.map(p => ({p, edges: edgeTransformer(p)}))
        .filter(_ => _.edges.length >= 3)
        .map(_ => loadPolygon({id: _.p.id, edges: _.edges}));

    return ({...geometry, polygons: [...unchanged, ...adaptedPolygons]});
};

// TODO: remove this function and use more general adaptPolygons 
const adaptPolygon = (poligon: IPolygon, geometry: IGeometry, edgeTransformer: (poligon: IPolygon)=>IEdge[]) => {
    let selectedPolygon: IPolygon;
    let others = geometry.polygons.reduce((acc, p) => {
        if (p.id === poligon.id) selectedPolygon = p;
        return (p.id !== poligon.id) ? acc.concat(p) : acc
    }, []);
    let adaptedPolygon = edgeTransformer(selectedPolygon);
    return (adaptedPolygon.length < 3) 
    ? ({...geometry, polygons: others})
    : ({...geometry, polygons: [...others, loadPolygon({id: selectedPolygon.id, edges: adaptedPolygon})]});
};

export const splitEdge = (cut: vector.Vector, edge: IEdge, poligon: IPolygon, geometry: IGeometry) => {
    return adaptPolygon(poligon, geometry, (selectedPolygon) => {
        return selectedPolygon.edges.reduce((acc, e) => {
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
            const index = vertices.indexOf(v);
            if (index >= 0) { 
                vertices.splice(index, 1);
                vector.copyIn(v.vector, doSnap(vector.add(v.vector, delta)));
            }
        };
        return p.edges.reduce((acc, e) => {
            moveVertex(e.start);
            moveVertex(e.end);            
            return acc.concat(e);
        }, [])
    });
}

export const removeVertex = (vertex: IVertex, poligon: IPolygon, geometry: IGeometry) => {
    return adaptPolygon(poligon, geometry, (selectedPolygon) => {
        const {edges} = selectedPolygon.edges.reduce((acc, e)=> {                
            if (e.end === vertex && acc.lastEnd) { // first vertex in polygon was removed and we arrive at the last edge
                e.end = acc.lastEnd;
                acc.edges.push(e);
            }
            else if (e.end === vertex) {  // edge end vertex is removed => store for next iteration to reassign end vertex 
                acc.previous = e;
                acc.edges.push(e);            
            } else if (acc.previous && e.start === vertex) { // ignore this edge and reassign previous end 
                acc.previous.end = e.end;            
            } else if (e.start === vertex) { // removing the start of the first edge, keep end until last edge
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

export const detectCollisions = (ray: IRay, geometry: IGeometry): RayCollisions => {
    const result: RayCollisions = {stats: {amount: 0, percentage: 0}, hits: []};
    let intersectionCalculations = 0;
    let totalEdges = 0;

    // TODO: replace this naive implementation with something more efficient:
    // 1) bounding box tests
    // 2) BSP
    // ...
    for (const polygon of geometry.polygons){
        totalEdges += polygon.edgeCount;
        if (!hasIntersect(ray, polygon.boundingBox)) continue;
        for (const edge of polygon.edges) {            
            intersectionCalculations += 1;
            const intersection = intersectRay(ray, segmentFrom(edge));
            if (intersection) {
                result.hits.push({polygon, ray, edge, intersection,
                    distance: vector.distance(intersection, ray.line[0]) * Math.cos(ray.angle)
                })
            }
        }
    }
    result.stats.percentage = intersectionCalculations/totalEdges;
    result.stats.amount = intersectionCalculations;
    return result;
}

// export const saveGeometry = (geometry: Geometry): IGeometry => {
//     return geometry;
// }