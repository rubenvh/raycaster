
import { Vector } from './vector';
import { IGeometry, IVertex, distance, IPolygon, loadPolygon, createPolygon, IStoredGeometry } from './vertex';

export class Geometry implements IGeometry{
    polygons: IPolygon[];
   
    constructor(geometry: IStoredGeometry) {
        this.polygons = geometry.polygons.map(_=>loadPolygon(_));
    }

    createPolygon = (vectors: Vector[]): IPolygon => {        
        const p = createPolygon(vectors);
        this.polygons.push(p);        
        return p;
    }

    detectVertexAt = (vector: Vector): {polygon: IPolygon, vertex: IVertex} => {
                
        const distanceComparer = (x: {distance:number}, y: {distance:number}) => y.distance - x.distance;

        return this.polygons.map(p => {
            let vertex = p.vertices
                .map(v => ({ vertex: v, distance: distance(v, vector)}))
                .filter(_ => _.distance <= 10)
                .sort(distanceComparer)[0];

            return {polygon: p, ...vertex};
        })
        .filter(_ => _.vertex)
        .sort(distanceComparer)[0];
    }
}

export const createGeometry = (polygonCollection: Vector[][]): Geometry => {
    const result = new Geometry({polygons: []});

    polygonCollection.forEach(vectors => {
        result.createPolygon(vectors);    
    });

    return result;
}

// export const saveGeometry = (geometry: Geometry): IGeometry => {
//     return geometry;
// }