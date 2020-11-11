import { LineSegment } from './lineSegment';
import { Vector } from "./vector";
import { Guid } from "guid-typescript";
export class Vertex implements IVertex {
    id: Guid;
    edges: Edge[] = [];
    vector: Vector;
    location: number[];
    
    constructor(vertex: IVertex) {
        this.id = vertex.id || Guid.create();
        this.location = vertex.location;
        this.vector = new Vector(...this.location);
    }
    
    joinTo = (vertex: Vertex): Edge => {
        let edge = new Edge({start: this, end: vertex});
        this.edges.push(edge);
        vertex.edges.push(edge);
        return edge;
    }    
}

export type IEntity = {id?: Guid};
export type IVertex = IEntity & { location: number[] };
export type IEdge = IEntity & { start: IVertex, end: IVertex};
export type IPolygon = IEntity & { edges: IEdge[]};
export type IGeometry = { polygons: IPolygon[]};

export class Edge implements IEdge {
    id: Guid;    
    segment: LineSegment;
    start: Vertex;
    end: Vertex;
    constructor(edge: IEdge) {        
        this.id = edge.id || Guid.create();
        this.start = new Vertex(edge.start);
        this.end = new Vertex(edge.end);
        this.segment = new LineSegment(this.start.vector, this.end.vector);
    }
}

export class Polygon implements IPolygon {
    id: Guid;
    edges: Edge[] = [];
    vertices: Vertex[] = [];

    constructor(polygon: IPolygon) {
        this.id = polygon.id || Guid.create();
        this.edges = polygon.edges.map(_ => new Edge(_));
        this.vertices = this.edges.map(_=>_.start);
    }
}