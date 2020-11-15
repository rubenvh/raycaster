import { Vector } from './vector';
import { IGeometry, IVertex, distance, IPolygon, loadPolygon, createPolygon, IStoredGeometry } from './vertex';

export type Collision = {polygon: IPolygon, vertex: IVertex};

export const loadGeometry = (geometry : IStoredGeometry): IGeometry => ({polygons: geometry.polygons.map(loadPolygon)});
export const createGeometry = (polygonCollection: Vector[][]): IGeometry => ({polygons: polygonCollection.map(createPolygon)});
export const addPolygon = (p: IPolygon, geometry: IGeometry): IGeometry => ({polygons: [...geometry.polygons, p]});
export const detectVertexAt = (vector: Vector, geometry: IGeometry): Collision => {
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



// export const saveGeometry = (geometry: Geometry): IGeometry => {
//     return geometry;
// }