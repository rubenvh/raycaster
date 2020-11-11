import { LineSegment } from './lineSegment';
import { Vector } from "./vector";
import { Guid } from "guid-typescript";
export class Vertex {
    id: Guid;
    edges: Edge[] = [];

    constructor(public location: Vector) {
        this.id = Guid.create();
    }
    
    joinTo = (vertex: Vertex): Edge => {
        let edge = new Edge(this, vertex);
        this.edges.push(edge);
        vertex.edges.push(edge);
        return edge;
    }    
}

export class Edge {
    id: Guid;
    segment: LineSegment;
    constructor(public start: Vertex, public end: Vertex) {
        this.id = Guid.create();
        this.segment = new LineSegment(start.location, end.location);
    }
}