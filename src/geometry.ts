
import { Edge, Vertex, Polygon, IGeometry } from './vertex';
import { Vector } from './vector';
export class Geometry implements IGeometry{
    polygons: Polygon[];
   
    constructor() {}
}

export const initGeometry = (polygonCollection: Vector[][]): Geometry => {
    const result = new Geometry();

    result.polygons = polygonCollection.map(vectors => {
        const vertices = vectors.map(_ => new Vertex({location: _.coordinates}));  
        const startingVertex = vertices[0];
        const edges: Edge[] = [];
        const lastVertex = vertices.slice(1).reduce((acc, v) => {                
                let edge = acc.joinTo(v);               
                edges.push(edge);
                return v;
        }, startingVertex);
        edges.push(lastVertex.joinTo(startingVertex));
        return new Polygon({edges})
    })
    return result;
}

// export const loadGeometry = (geometry: IGeometry): Geometry => {
//     return new Geometry(geometry);
// }

// export const saveGeometry = (geometry: Geometry): IGeometry => {
//     return geometry;
// }