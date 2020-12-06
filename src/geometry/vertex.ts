import { ILineSegment, IRay, intersectRay } from './lineSegment';
import { Guid } from "guid-typescript";

import * as vector from './vector';
import { intersect } from 'mathjs';

export type Color = [number, number, number, number];
export type IMaterial = {color: Color};
export type IEntity = {id?: Guid};
export type IVertex = IEntity & { vector: vector.Vector };
export type IEdge = IEntity & { start: IVertex, end: IVertex, material?: IMaterial, immaterial?: boolean};
export type IStoredPolygon = IEntity & { edges: IEdge[]};
export type IPolygon = IStoredPolygon & { vertices: IVertex[], boundingBox: BoundingBox, edgeCount: number };
export type IStoredGeometry = IEntity & { polygons: IStoredPolygon[]};
export type IGeometry = { polygons: IPolygon[]};
export type BoundingBox = [vector.Vector, vector.Vector];

export const makeVertex = (v: vector.Vector): IVertex => ({vector: v});
export const makeEdge = (v: vector.Vector, u: vector.Vector): IEdge => ({start: makeVertex(v), end: makeVertex(u)});
export const segmentFrom = (e: IEdge): ILineSegment => [e.start.vector, e.end.vector];
const isVertex = (v: IVertex|vector.Vector): v is IVertex => (v as IVertex).vector !== undefined;    
const giveIdentity = <T extends IEntity>(e : T): T => e.id ? e : ({...e, id: Guid.create()});
const getVector = (vertexOrVector: IVertex|vector.Vector): vector.Vector => isVertex(vertexOrVector) ? vertexOrVector.vector : vertexOrVector;
export const distance = (vertex: IVertex|vector.Vector, v: IVertex|vector.Vector): number => vector.distance(getVector(vertex), getVector(v));
const areEqual = (u: IVertex, v: IVertex) => u && v && u.vector.length === v.vector.length && u.vector.every((x, i) => x === v.vector[i]);
export const areClose = (vertex: IVertex|vector.Vector, v: IVertex|vector.Vector, epsilon: number = 0.005): boolean => { // TODO: magic constant
    let d = distance(vertex, v);
    return d <= epsilon; 
}

const minimumComponents = (u: vector.Vector, v: vector.Vector): vector.Vector => [Math.min(u[0], v[0]), Math.min(u[1], v[1])];
const maximumComponents = (u: vector.Vector, v: vector.Vector): vector.Vector => [Math.max(u[0], v[0]), Math.max(u[1], v[1])];
export const loadPolygon = (polygon: IStoredPolygon): IPolygon => {
    let [min, max]: BoundingBox = [[Infinity, Infinity], [-Infinity, -Infinity]];
    const result = {
        ...polygon,
        edges: polygon.edges.reduce((acc, e) => {
            [min, max] = [minimumComponents(min, e.start.vector), maximumComponents(max, e.start.vector)];
            e.start = giveIdentity(e.start);
            if (acc.first && areClose(e.end, acc.first.start)) {                
                e.end = giveIdentity(acc.first.start);
            }
            if (acc.previous && !areEqual(e.start, acc.previous.end)) {
                throw new Error(`polygon cannot contain jumps: start of edge should be equal to previous edge's end: ${acc.previous.end.vector} does not equal ${e.start.vector}`);                
            }
            else {
                e.start = giveIdentity(acc.previous && acc.previous.end || e.start);
                e.end = giveIdentity(e.end);
            }
            
            let edge = giveIdentity(e);            
            return ({ 
                first: acc.first || edge, 
                previous: edge, 
                edges: [...acc.edges, edge]
            });
        }, {edges:[]} as {first?: IEdge, previous?: IEdge, edges: IEdge[] }).edges,
        vertices: []};   

    return giveIdentity({...result, 
        edgeCount: result.edges.length,
        vertices: result.edges.map(_=>_.start),
        boundingBox: [min, max]});
}

export const createPolygon = (vectors: vector.Vector[]): IPolygon => {
        
    // transform all vectors into vertices
    const vertices = vectors.map(makeVertex).map(giveIdentity);
    const startingVertex = vertices[0];
    
    // we are closing the polygon at the end, so remove the last vertex if it's close to the starting vertex
    if (areClose(startingVertex, vertices[vertices.length-1])) vertices.pop();       
    
    // put start at the end and reduce over the vertices to create a collection of edges
    const edges = vertices.slice(1).concat([startingVertex])
        .reduce((acc, v) => { 
            const translucent = Math.random()<0.3;
            const translucency = Math.random();
            const immaterial = Math.random()<=0.2;
            return ({ 
                                edges: [...acc.edges, ({
                                    start: acc.previous, 
                                    end: v,
                                    material: {color: [20, 20, 255, immaterial ? 0 : translucent ? translucency : 1] as Color},
                                    immaterial
                                })],
                                previous: v,
                            });}, 
            {previous: startingVertex, edges: [] as IEdge[]})
        .edges;
    
    return loadPolygon({edges});
};

export const hasIntersect = (ray: IRay, box: BoundingBox) => {
    const [x1, y1, x2, y2] = [box[0][0], box[0][1], box[1][0], box[1][1]];
    // TODO: improve ray/AABB intersection tests (we don't need the actual intersection, existance is enough)
    return intersectRay(ray, [[x1, y1], [x2, y1]])
        || intersectRay(ray, [[x2, y1], [x2, y2]])
        || intersectRay(ray, [[x2, y2], [x1, y2]])
        || intersectRay(ray, [[x1, y2], [x1, y1]]);
}
