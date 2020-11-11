import { Edge, Vertex } from './vertex';
import { Vector } from './vector';
export class Geometry{
    edges: Edge[] = [];
    vertices: Vertex[] = [];

    constructor(edgesCollection: Vector[][]) {
        edgesCollection.map(vectors => {
            this.vertices = vectors.map(_ => new Vertex(_));            
            let startingVertex = this.vertices[0];
            
            let lastVertex = this.vertices.slice(1).reduce((acc, v) => {                
                let edge = acc.joinTo(v);               
                this.edges.push(edge);
                return v;
            }, startingVertex);
            this.edges.push(lastVertex.joinTo(startingVertex));
        });
    }
}