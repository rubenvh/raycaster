
import { IRay } from './camera';
import { intersectRay } from './lineSegment';
import { Vector } from './vector';
import { IGeometry, IVertex, distance, IPolygon, loadPolygon, createPolygon, IStoredGeometry, IEdge } from './vertex';

export type Collision = {polygon: IPolygon, distance: number};
export type VertexCollision = Collision & { vertex: IVertex };
export type EdgeCollision = Collision & {edge: IEdge };
export type RayHit = {polygon: IPolygon, edge: IEdge, intersection: Vector, ray: IRay};

export const loadGeometry = (geometry : IStoredGeometry): IGeometry => ({polygons: geometry.polygons.map(loadPolygon)});
export const createGeometry = (polygonCollection: Vector[][]): IGeometry => ({polygons: polygonCollection.map(createPolygon)});
export const addPolygon = (p: IPolygon, geometry: IGeometry): IGeometry => ({polygons: [...geometry.polygons, p]});
export const detectVertexAt = (vector: Vector, geometry: IGeometry): VertexCollision => {
    const distanceComparer = (x: {distance:number}, y: {distance:number}) => y.distance - x.distance;

        return geometry.polygons.map(p => {
            let vertex = p.vertices
                .map(v => ({ vertex: v, distance: distance(v, vector)}))
                .filter(_ => _.distance <= 10)
                .sort(distanceComparer)[0];

            return {polygon: p, ...vertex};
        })
        .filter(_ => _.vertex)
        .sort(distanceComparer)[0];
} 

export const detectCollisions = (ray: IRay, geometry: IGeometry): RayHit[] => {
    return geometry.polygons
        .map(p => [...p.edges
            .map(e => ({ray, edge: e, 
                intersection: intersectRay(ray, [e.start.vector, e.end.vector]),                
            }))
            .filter(_ => !!_.intersection)
            .map(_ => ({..._, polygon: p}))])
        .reduce((acc, i) => [...acc, ...i], []);
}

// export const saveGeometry = (geometry: Geometry): IGeometry => {
//     return geometry;
// }