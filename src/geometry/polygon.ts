import { maximumComponents, minimumComponents, Vector } from "../math/vector";
import { IEdge } from "./edge";
import { giveIdentity, IEntity } from "./entity";
import { Color } from "./properties";
import { areClose, areEqual, IVertex, makeVertex } from "./vertex";

export type IStoredPolygon = IEntity & { edges: IEdge[]};
export type IPolygon = IStoredPolygon & { vertices: IVertex[], boundingBox: BoundingBox, edgeCount: number };
export type BoundingBox = [Vector, Vector];

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

export const createPolygon = (vectors: Vector[]): IPolygon => {
        
    // transform all vectors into vertices
    const vertices = vectors.map(makeVertex).map(giveIdentity);
    const startingVertex = vertices[0];
    
    // we are closing the polygon at the end, so remove the last vertex if it's close to the starting vertex
    if (areClose(startingVertex, vertices[vertices.length-1])) vertices.pop();       
    
    // put start at the end and reduce over the vertices to create a collection of edges
    const edges = vertices.slice(1).concat([startingVertex])
        .reduce((acc, v) => {            
            return ({ 
                                edges: [...acc.edges, ({
                                    start: acc.previous, 
                                    end: v,
                                    material: {color: [20, 20, 255, 1] as Color},
                                    immaterial: false
                                })],
                                previous: v,
                            });}, 
            {previous: startingVertex, edges: [] as IEdge[]})
        .edges;
    
    return loadPolygon({edges});
};