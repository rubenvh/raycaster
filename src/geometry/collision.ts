import { ILineSegment } from './../math/lineSegment';
import { distanceToMidPoint, ILine } from "../math/lineSegment";
import { add, cross, dot, normalize, scale, subtract, Vector } from "../math/vector";
import { IEdge } from "./edge";
import { BoundingBox, IPolygon } from "./polygon";
import { distance, IVertex } from "./vertex";
import { Face, getMaterial, IMaterial } from './properties';

export type Collision = VertexCollision | EdgeCollision;
type BaseCollision = {polygon: IPolygon, distance: number, kind: string};
export type VertexCollision = BaseCollision & { vertex: IVertex, kind: "vertex"};
export type EdgeCollision = BaseCollision & {edge: IEdge, kind: "edge" };
export type Intersection = {point: Vector, face: Face};
export type RayHit = {polygon: IPolygon, edge: IEdge, intersection: Intersection, ray: IRay, distance: number};
export type IntersectionStats = {percentage: number, amount: number };
export type RayCollisions = {hits: RayHit[], stats: IntersectionStats};
export type IRay = {position: Vector, direction: Vector, dn: Vector, dperp: Vector, line: ILine, ood: Vector, angle: number, }; 

export const makeRay = (p: Vector, d: Vector, angle: number = 0): IRay => {
    const line: ILine = [p, add(p, d)];
    const dn = normalize(d);    
    return ({ position: p, direction: d, 
        dn, 
        dperp: [-dn[1], dn[0]],     
        ood: [1/d[0], 1/d[1]],
        line, 
        angle});
}
export const hasIntersect = (ray: IRay, box: BoundingBox): boolean => {
    const p = ray.position,
          d = ray.direction,
          a = box;
    let tmin = 0.0;
    let tmax = Number.MAX_VALUE;
    for (let i = 0; i < 2; i++) {
        if (Math.abs(d[i]) < Number.EPSILON) {
            if (p[i] < a[0][i] || p[i] > a[1][i]) return false;
        } else {
            const ood = ray.ood[i];
            let t1 = (a[0][i] - p[i]) * ood;
            let t2 = (a[1][i] - p[i]) * ood;
            if (t1 > t2) { 
                const temp = t1;
                t1 = t2;
                t2 = temp;
            }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmin > tmax) return false;
        }
    }
    // The intersection if needed could be calculated as follows:    
    // const intersection = add(p, scale(tmin, d));
    return true;
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
        if (polygon.edgeCount > 4 && !hasIntersect(ray, polygon.boundingBox)) continue;
        for (const edge of polygon.edges) {            
            intersectionCalculations += 1;
            const intersection = intersectRay(ray, edge.segment);                                    
            if (intersection) {
                result.hits.push({polygon, ray, edge, intersection,
                    distance: distance(intersection.point, ray.line[0]) * Math.cos(ray.angle)
                })
            }
        }
    }
    result.stats.percentage = intersectionCalculations/totalEdges;
    result.stats.amount = intersectionCalculations;
    return result;
}

export const intersectRay = (ray: IRay, s: ILineSegment): Intersection => {
    let a = s[0];
    let b = s[1];    
    let v1 = subtract(ray.position, a);
    let v2 = subtract(b, a);    
    let c = cross(v2, v1);    
    let d_v2 = dot(v2, ray.dperp);
    let d_v1 = dot(v1, ray.dperp);
    let t1 = c / d_v2;
    let t2 = d_v1 / d_v2;
    if (t1 >=  0 && t2 >= 0 && t2 <= 1) return ({
        point: add(ray.position, scale(t1, ray.dn)),
        face: c < 0 ? Face.interior : Face.exterior
    });
    return null;
  }

  export const lookupMaterialFor = (hit: RayHit): IMaterial => hit.intersection && getMaterial(hit.intersection.face, hit.edge?.material);