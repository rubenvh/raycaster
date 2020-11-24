
import { IRay } from './camera';
import { distanceTo, intersectRay } from './lineSegment';
import * as vector from './vector';
import { IGeometry, IVertex, distance, IPolygon, loadPolygon, createPolygon, IStoredGeometry, IEdge, segmentFrom } from './vertex';

export type Collision = {polygon: IPolygon, distance: number};
export type VertexCollision = Collision & { vertex: IVertex, kind: "vertex"};
export type EdgeCollision = Collision & {edge: IEdge, kind: "edge" };
export type RayHit = {polygon: IPolygon, edge: IEdge, intersection: vector.Vector, ray: IRay, distance: number};

export const loadGeometry = (geometry : IStoredGeometry): IGeometry => ({polygons: geometry.polygons.map(loadPolygon)});
export const createGeometry = (polygonCollection: vector.Vector[][]): IGeometry => ({polygons: polygonCollection.map(createPolygon)});
export const addPolygon = (p: IPolygon, geometry: IGeometry): IGeometry => ({polygons: [...geometry.polygons, p]});

export const detectCollisionAt = (vector: vector.Vector, geometry: IGeometry): VertexCollision|EdgeCollision => {
    const distanceComparer = (x: {distance:number}, y: {distance:number}) => y.distance - x.distance;

        return geometry.polygons.reduce((acc, p) => {            
            let edges: Collision[] = p.edges
                .map(e => ({polygon: p, kind: "edge", edge: e, distance: distanceTo(vector, segmentFrom(e))} as const));
            let vertices: Collision[] = p.vertices
            .map(v => ({ polygon: p, kind: "vertex", vertex: v, distance: distance(v, vector)} as const));

            let closest = edges.concat(vertices)                
            .filter(_ => _.distance <= 10)
            .sort(distanceComparer)[0];
            return closest ? acc.concat(closest) : acc;
        }, [])
        .sort(distanceComparer)[0];
} 

export const detectCollisions = (ray: IRay, geometry: IGeometry): RayHit[] => {
    const result: RayHit[] = [];
    for (const p of geometry.polygons){
        for (const e of p.edges) {
            const i = intersectRay(ray, [e.start.vector, e.end.vector]);
            if (i) {
                result.push({
                    polygon: p,
                    ray,
                    edge: e,
                    intersection: i,
                    distance: vector.distance(i, ray.line[0]) * Math.cos(ray.angle)
                })
            }
        }
    }
    return result;
}

// export const saveGeometry = (geometry: Geometry): IGeometry => {
//     return geometry;
// }