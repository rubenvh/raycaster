import { distanceToMidPoint, ILine, intersectRay } from "../math/lineSegment";
import { Vector } from "../math/vector";
import { IEdge } from "./edge";
import { BoundingBox, IPolygon } from "./polygon";
import { distance, IVertex } from "./vertex";

export type Collision = VertexCollision | EdgeCollision;
type BaseCollision = {polygon: IPolygon, distance: number, kind: string};
export type VertexCollision = BaseCollision & { vertex: IVertex, kind: "vertex"};
export type EdgeCollision = BaseCollision & {edge: IEdge, kind: "edge" };
export type RayHit = {polygon: IPolygon, edge: IEdge, intersection: Vector, ray: IRay, distance: number};
export type IntersectionStats = {percentage: number, amount: number };
export type RayCollisions = {hits: RayHit[], stats: IntersectionStats};
export type IRay = {line: ILine, angle: number}; 

export const hasIntersect = (ray: IRay, box: BoundingBox) => {
    const [x1, y1, x2, y2] = [box[0][0], box[0][1], box[1][0], box[1][1]];
    // TODO: improve ray/AABB intersection tests (we don't need the actual intersection, existence is enough)
    return intersectRay(ray.line, [[x1, y1], [x2, y1]])
        || intersectRay(ray.line, [[x2, y1], [x2, y2]])
        || intersectRay(ray.line, [[x2, y2], [x1, y2]])
        || intersectRay(ray.line, [[x1, y2], [x1, y1]]);
}

export const detectCollisionAt = (vector: Vector, polygons: IPolygon[]): VertexCollision|EdgeCollision => {
    const distanceComparer = (x: {distance:number}, y: {distance:number}) => x.distance - y.distance;
        return polygons.reduce((acc, p) => {            
            let edges: Collision[] = p.edges
                .map(e => ({polygon: p, kind: "edge", edge: e, distance: distanceToMidPoint(vector, e.segment)} as const));
            let vertices: Collision[] = p.vertices
            .map(v => ({ polygon: p, kind: "vertex", vertex: v, distance: distance(v, vector)} as const));

            let closest = edges.concat(vertices)                
            .filter(_ => _.distance <= 10)
            .sort(distanceComparer)[0];
            return closest ? acc.concat(closest) : acc;
        }, [])
        .sort(distanceComparer)[0];
} 

export const detectCollisions = (ray: IRay, polygons: IPolygon[]): RayCollisions => {
    const result: RayCollisions = {stats: {amount: 0, percentage: 0}, hits: []};
    let intersectionCalculations = 0;
    let totalEdges = 0;

    // TODO: replace this naive implementation with something more efficient:
    // 1) bounding box tests 
    // 2) BSP
    // ...
    for (const polygon of polygons){
        totalEdges += polygon.edgeCount;
        if (!hasIntersect(ray, polygon.boundingBox)) continue;
        for (const edge of polygon.edges) {            
            intersectionCalculations += 1;
            const intersection = intersectRay(ray.line, edge.segment);
            if (intersection) {
                result.hits.push({polygon, ray, edge, intersection,
                    distance: distance(intersection, ray.line[0]) * Math.cos(ray.angle)
                })
            }
        }
    }
    result.stats.percentage = intersectionCalculations/totalEdges;
    result.stats.amount = intersectionCalculations;
    return result;
}