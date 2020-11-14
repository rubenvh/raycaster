import { LineSegment } from './lineSegment';
import { Guid } from "guid-typescript";

import * as vector from './vector';

export type IEntity = {id?: Guid};
export type IVertex = IEntity & { vector: vector.Vector };
export type IEdge = IEntity & { start: IVertex, end: IVertex};
export type IPolygon = IEntity & { edges: IEdge[]};
export type IGeometry = { polygons: IPolygon[]};

const giveIdentity = (vertex: IVertex): IVertex => vertex.id ? vertex : ({id: Guid.create(), vector: vertex.vector});
const getVector = (vertexOrVector: IVertex|vector.Vector): vector.Vector => {    
    // TODO: type guard vector.isVector(vertexOrVector)
    if (Array.isArray(vertexOrVector)) {
        return vertexOrVector;
    } else {
        return vertexOrVector.vector;
    }
}
export const distance = (vertex: IVertex, v: IVertex|vector.Vector): number => {    
    return vector.distance(vertex.vector, getVector(v));
};
const areEqual = (u: IVertex, v: IVertex) => u && v && u.vector.length === v.vector.length && u.vector.every((x, i) => x === v.vector[i]);
const areClose = (vertex: IVertex, v: IVertex|vector.Vector): boolean => {                
    let d = distance(vertex, v);
    return d <= 0.005; // TODO: magic constant
}

export class Edge implements IEdge {
    id: Guid;    
    segment: LineSegment;
    start: IVertex;
    end: IVertex;
    constructor(edge: IEdge) {        
        this.id = edge.id || Guid.create();
        this.start = giveIdentity(edge.start);        
        this.end = giveIdentity(edge.end);
        this.segment = new LineSegment(this.start.vector, this.end.vector);
    }
}



export class Polygon implements IPolygon {
    id: Guid;
    edges: Edge[] = [];
    vertices: IVertex[] = [];

    constructor(polygon: IPolygon) {
        this.id = polygon.id || Guid.create();
        this.edges = polygon.edges.reduce((acc, e) => {
            if (acc.first && areClose(e.end, acc.first.start)) {
                e.end = acc.first.start;
            }
            if (acc.previous && !areEqual(e.start, acc.previous.end)) {
                throw new Error(`polygon cannot contain jumps: start of edge should be equal to previous edge's end: ${acc.previous.end.vector} does not equal ${e.start.vector}`);                
            }
            else {
                e.start = acc.previous && acc.previous.end || e.start;
            }
            
            let start = giveIdentity(e.start);
            let end = giveIdentity(e.end);
            let edge = new Edge({start, end});
            edge.id = e.id || edge.id;
            
            return ({ 
                first: acc.first || edge, 
                previous: edge, 
                edges: [...acc.edges, edge]
            });
        }, {edges:[]} as {first?: Edge, previous?: Edge, edges: Edge[] }).edges;
        this.vertices = this.edges.map(item => item.start);        
    }

    static createPolygon = (vectors: vector.Vector[]): Polygon => {
        
        // transform all vectors into vertices
        const vertices = vectors.map(_ => giveIdentity({vector: _}));
        const startingVertex = vertices[0];
        
        // we are closing the polygon at the end, so remove the last vertex if it's close to the starting vertex
        if (areClose(startingVertex, vertices[vertices.length-1])) vertices.pop();       
        
        // put start at the end and reduce over the vertices to create a collection of edges
        const result = vertices.slice(1).concat([startingVertex])
            .reduce((acc, v) => ({ 
                                    edges: [...acc.edges, ({start: ({vector: acc.previous.vector}), end: ({vector: v.vector})})],
                                    previous: v,
                                }), 
                {previous: startingVertex, edges: [] as IEdge[]});
        
        return new Polygon({edges: result.edges});
    }
}