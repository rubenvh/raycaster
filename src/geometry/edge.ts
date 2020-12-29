import { ILineSegment } from "../math/lineSegment";
import { Vector } from "../math/vector";
import { giveIdentity, IEntity } from "./entity";
import { cloneMaterial, Color, IMaterial } from "./properties";
import { areClose, areEqual, cloneVertex, duplicateVertex, IVertex, makeVertex } from "./vertex";

export type IEdge = IEntity & { start: IVertex, end: IVertex, material?: IMaterial, immaterial?: boolean};

export const makeEdge = (v: Vector, u: Vector): IEdge => ({start: makeVertex(v), end: makeVertex(u)});
export const segmentFrom = (e: IEdge): ILineSegment => [e.start.vector, e.end.vector];

export const duplicateEdge = (e: IEdge, delta: Vector): IEdge => giveIdentity<IEdge>({
        start: duplicateVertex(e.start, delta),
        end: duplicateVertex(e.end, delta),
        immaterial: e.immaterial,
        material: cloneMaterial(e.material),
});

export const cloneEdge = (e: IEdge): IEdge => ({
    id: e.id,
    start: cloneVertex(e.start),
    end: cloneVertex(e.end),
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),
});

export const createEdges = (vectors: Vector[]): IEdge[] =>  {
    // transform all vectors into vertices
    const vertices = vectors.map(makeVertex).map(giveIdentity);
    const startingVertex = vertices[0];
    
    // we are closing the polygon at the end, so remove the last vertex if it's close to the starting vertex
    if (areClose(startingVertex, vertices[vertices.length-1])) vertices.pop();       
    
    // put start at the end and reduce over the vertices to create a collection of edges
    return vertices.slice(1).concat([startingVertex])
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
}
