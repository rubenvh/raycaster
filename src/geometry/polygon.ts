import { midpoint } from "../math/lineSegment";
import { maximumComponents, minimumComponents, Vector } from "../math/vector";
import { createEdges, IEdge } from "./edge";
import { giveIdentity, IEntity } from "./entity";
import { areClose, areEqual, IVertex } from "./vertex";

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
    const edges = createEdges(vectors);    
    return loadPolygon({edges});
};

export const normalize = (box: BoundingBox): BoundingBox => {
    return [minimumComponents(box[0], box[1]), maximumComponents(box[0], box[1])];
};
export const merge = (b1: BoundingBox, b2: BoundingBox): BoundingBox => {
    const [b1n, b2n] = [normalize(b1), normalize(b2)];
    return [minimumComponents(b1n[0], b2n[0]), maximumComponents(b1n[1], b2n[1])];
}
export const contains = (region: BoundingBox, box: BoundingBox) => {
    const [a1, a2] = normalize(region);
    const [b1, b2] = normalize(box);
    return a1[0] <= b1[0] && a1[1] <= b1[1]
        && a2[0] >= b2[0] && a2[1] >= b2[1];    
};

export const containsEdge = (edge: IEdge, box: BoundingBox) => contains(box, [edge.start.vector, edge.end.vector]);
export const containsVertex = (vertex: IVertex, box: BoundingBox) => contains(box, [vertex.vector, vertex.vector]);
export const centerOf = (box: BoundingBox) => midpoint(box);