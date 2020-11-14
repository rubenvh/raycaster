
import { Vector } from './vector';
import { Polygon, IGeometry, Vertex } from './vertex';

export class Geometry implements IGeometry{
    polygons: Polygon[];
   
    constructor(geometry: IGeometry) {
        this.polygons = geometry.polygons.map(_=>new Polygon(_));
    }

    createPolygon = (vectors: Vector[]): Polygon => {        
        const p = Polygon.createPolygon(vectors);
        this.polygons.push(p);        
        return p;
    }

    detectVertexAt = (vector: Vector): {polygon: Polygon, vertex: Vertex} => {
                
        const distanceComparer = (x: {distance:number}, y: {distance:number}) => y.distance - x.distance;

        return this.polygons.map(p => {
            let vertex = p.vertices
                .map(v => ({ vertex: v, distance: v.distanceTo(vector)}))
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