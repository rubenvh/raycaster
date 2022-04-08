import { lineAngle, midpoint, slope } from "../math/lineSegment";
import { angleBetween, maximumComponents, minimumComponents, subtract, Vector } from "../math/vector";
import { createEdges, IEdge, IStoredEdge, loadEdge, storeEdge } from "./edge";
import { cloneKey, giveIdentity, IEntity } from "./entity";
import { areClose, areEqual, IVertex } from "./vertex";

export type IStoredPolygon = IEntity & { edges: IStoredEdge[]};
export type IPolygon = IEntity & { edges: IEdge[], vertices: IVertex[], boundingBox: BoundingBox, edgeCount: number };
export type BoundingBox = [Vector, Vector];

export const storePolygon = (p: IPolygon): IStoredPolygon => ({
    id: cloneKey(p.id),
    edges: p.edges.map(storeEdge),
});
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
            if (acc.previous && !areEqual(e.start, acc.previous.end)) { // TODO: areClose?
                throw new Error(`polygon cannot contain jumps: start of edge should be equal to previous edge's end: ${acc.previous.end.vector} does not equal ${e.start.vector}`);                
            }
            else {
                e.start = giveIdentity(acc.previous && acc.previous.end || e.start);
                e.end = giveIdentity(e.end);
            }
            
            let edge = giveIdentity(loadEdge(e));            
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

/**
 * This function determines whether a polygon is convex or concave.
 * @param polygon 
 * @returns true when polygon is convex
 */
export const isConvex = (polygon: IPolygon): boolean => {
    // triangles are always convex (as are points and segments)
    if (polygon.vertices.length <= 3) return true;
    
    const last = polygon.vertices.length-1;
    let result = true, sign = 1;

    for (let i = 0; i <= last; i++) {    
        // alias for 3 consecutive vertices    
        const curr = polygon.vertices[i].vector;
        const prev = polygon.vertices[i === 0 ? last : i - 1].vector;
        const next = polygon.vertices[i === last ? 0 : i + 1].vector;
        
        // when the 3 points are colinear -> convex so skip any angle calculation
        const m1 = slope([prev, curr]);
        const m2 = slope([curr, next]);
        if (m1 === m2) { continue; }

        // calculate angle between 3 points
        const angle = lineAngle([curr, prev], [curr, next]);

        // set reference sign first loop to neutralize clock or counterclockwise polygon direction
        if (i === 0) { sign = angle/Math.abs(angle); }
        
        // angle times sign should be larger than zero for convex polygons
        result = result && (angle * sign > 0);
        
        // exit loop when polygon detected not to be convex
        if (!result) { break; }
    }
    return result;
}