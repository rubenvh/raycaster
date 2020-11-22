
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
    return geometry.polygons
        .map(p => [...p.edges
            .map(e => ({ray, edge: e, 
                intersection: intersectRay(ray, [e.start.vector, e.end.vector]),                
            }))
            .filter(_ => !!_.intersection)
            .map(_ => ({..._, 
                polygon: p, 
                distance: vector.distance(_.intersection, ray.line[0]) * Math.cos(ray.angle)}))])
        .reduce((acc, i) => [...acc, ...i], []);
}

// export const saveGeometry = (geometry: Geometry): IGeometry => {
//     return geometry;
// }