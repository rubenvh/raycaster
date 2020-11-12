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

    joinedWith = (edge: Edge): void => {
        if (!same(edge.start, this) && !same(edge.end, this)) throw new Error(`Adding unrelated edge to vertex edges list: v(${this.location}), e[${edge.start.location} - ${edge.end.location}] `);
        if (this.edges.includes(edge)) this.edges.push(edge);
    }
    
    joinTo = (vertex: Vertex): Edge => {
        let edge = new Edge({start: this, end: vertex});
        this.edges.push(edge);
        vertex.edges.push(edge);
        return edge;
    };

    distanceTo = (vertex: Vertex|Vector|number[]): number => {
        let target: Vector;
        if (vertex instanceof Vertex) {
            target = vertex.vector;
        } else if (vertex instanceof Vector) {
            target = vertex;
        } else {
            target = new Vector(...vertex);
        }
        return this.vector.distanceTo(target);
    }
    
    isSame = (vertex: Vertex|Vector|number[]): boolean => {                
        let d = this.distanceTo(vertex);
        return d <= 0.005; // TODO: magic constant
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
        this.start = edge.start instanceof Vertex ?  edge.start : new Vertex(edge.start);        
        this.end = edge.end instanceof Vertex ? edge.end : new Vertex(edge.end);
        this.start.joinedWith(this);       
        this.end.joinedWith(this);
        this.segment = new LineSegment(this.start.vector, this.end.vector);
    }
}

const same = (u: IVertex, v: IVertex) => u && v && u.location.length === v.location.length && u.location.every((x, i) => x === v.location[i]);

export class Polygon implements IPolygon {
    id: Guid;
    edges: Edge[] = [];
    vertices: Vertex[] = [];

    constructor(polygon: IPolygon) {
        this.id = polygon.id || Guid.create();
        this.edges = polygon.edges.reduce((acc, e) => {
            if (acc.first && new Vertex(e.end).isSame(acc.first.start)) {
                e.end = acc.first.start;
            }
            if (acc.previous && !same(e.start, acc.previous.end)) {
                throw new Error(`polygon cannot contain jumps: start of edge should be equal to previous edge's end: ${acc.previous.end.location} does not equal ${e.start.location}`);                
            }
            else {
                e.start = acc.previous && acc.previous.end || e.start;
            }
            
            let start = e.start instanceof Vertex ? e.start : new Vertex(e.start);
            let end = e.end instanceof Vertex ? e.end : new Vertex(e.end);    
            let edge = start.joinTo(end);
            edge.id = e.id || edge.id;
            
            return ({ 
                first: acc.first || edge, 
                previous: edge, 
                edges: [...acc.edges, edge]
            });
        }, {edges:[]} as {first?: Edge, previous?: Edge, edges: Edge[] }).edges;
        this.vertices = this.edges.map(item => item.start);        
    }

    static createPolygon = (vectors: Vector[]): Polygon => {
        
        // transform all vectors into vertices
        const vertices = vectors.map(_ => new Vertex({location: _.coordinates}));
        const startingVertex = vertices[0];
        
        // we are closing the polygon at the end, so remove the last vertex if it's close to the starting vertex
        if (startingVertex.isSame(vertices[vertices.length-1])) vertices.pop();       
        
        // put start at the end and reduce over the vertices to create a collection of edges
        const result = vertices.slice(1).concat([startingVertex])
            .reduce((acc, v) => ({ 
                                    edges: [...acc.edges, ({start: ({location: acc.previous.location}), end: ({location: v.location})})],
                                    previous: v,
                                }), 
                {previous: startingVertex, edges: [] as IEdge[]});
        
        return new Polygon({edges: result.edges});
    }
}