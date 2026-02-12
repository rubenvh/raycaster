import { Plane } from './../math/plane';
import { ILineSegment } from './../math/lineSegment';
import { distanceToMidPoint, ILine } from "../math/lineSegment";
import { add, cross, dot, normalize, perpendicular, scale, subtract, Vector, subtractInto, scaleInto, addInto } from "../math/vector";
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
export type IntersectionStats = {totalEdges: number, testedEdges: number, totalPolygons: number, testedPolygons: number, polygons: Set<string> };
export type RayCollisions = {hits: RayHit[], stats: IntersectionStats, ray: IRay};
export type PolygonIntersections = {hits: RayHit[], stop: boolean, edgeCount: number, polygonCount: number, polygonIds: Set<string>};
export const createEmptyIntersection = (): PolygonIntersections => ({hits: [], stop: false, edgeCount: 0, polygonCount: 0, polygonIds: new Set<string>()});
export type IRay = {position: Vector, direction: Vector, dn: Vector, dperp: Vector, line: ILine, ood: Vector, angle: number, cosAngle: number}; 
export type RayCastingOptions = {earlyExitPredicate?: (hit: RayHit) => boolean, edgeFilter?: (e: IEdge) => boolean};

export const makeRay = (p: Vector, d: Vector, angle: number = 0): IRay => {
    const line: ILine = [p, add(p, d)];
    const dn = normalize(d);    
    return ({ position: p, direction: d, 
        dn, 
        dperp: perpendicular(dn),     
        ood: [1/d[0], 1/d[1]],
        line, 
        angle,
        cosAngle: Math.cos(angle)});
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

/**
 * This function is used to detect collision candidates at a given point (vector)
 * @param vector a query point 
 * @param polygons a collection of polygons for which to find collisions with query point
 * @returns a collection of edge- and/or vertex-collisions
 */
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

// Scratch vectors for intersection calculations (reused to avoid allocations in hot paths)
const _v1: Vector = [0, 0];
const _v2: Vector = [0, 0];
const _point: Vector = [0, 0];
const _planePoint: Vector = [0, 0]; // Scratch vector for intersectRayPlane

export const intersectRaySegment = (ray: IRay, s: ILineSegment): Intersection => {    
    // Reuse scratch vectors instead of allocating new ones
    subtractInto(_v1, ray.position, s[0]);
    subtractInto(_v2, s[1], s[0]);
    
    let c = cross(_v2, _v1);    
    let d_v2 = dot(_v2, ray.dperp);
    let d_v1 = dot(_v1, ray.dperp);
    let t1 = c / d_v2;
    let t2 = d_v1 / d_v2;
    
    if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
        // Calculate intersection point using scratch vector, then copy out for return
        scaleInto(_point, t1, ray.dn);
        addInto(_point, ray.position, _point);
        return {
            point: [_point[0], _point[1]], // Copy to new array for safe return
            face: c < 0 ? Face.exterior : Face.interior
        };
    }
    return null;
};

export const intersectRayPlane = (ray: IRay, plane: Plane): Intersection => {    
    const denom = dot(plane.n, ray.direction);
    if (denom === 0) { return null;  }
    const dist = plane.d - dot(plane.n, ray.position);
    const t = dist / denom;    
    if (t >= 0) {
        // Use scratch vector then copy to avoid allocation in hot path
        scaleInto(_planePoint, t, ray.direction);
        addInto(_planePoint, ray.position, _planePoint);
        return {
            point: [_planePoint[0], _planePoint[1]], // Copy to new array for safe return
            face: denom < 0 ? Face.exterior : Face.interior
        };
    }
    return null;
}

export function intersectRayPolygons(polygons: IPolygon[], ray: IRay, options: RayCastingOptions): PolygonIntersections {    
    const result: PolygonIntersections = {hits: [], stop: false, edgeCount: 0, polygonCount: polygons.length, polygonIds: new Set<string>()};
    for (let i=0, n=polygons.length; i<n; i++){
        const polygon = polygons[i];
        if (polygon.edgeCount > 5 && !hasIntersect(ray, polygon.boundingBox)) continue;
        result.polygonIds.add(polygon.id);

        for (let j=0, m=polygon.edges.length; j<m; j++) {
            const edge = polygon.edges[j];
            let hit = intersectRayEdge(edge, ray, options);
            if (hit == null) { continue; }            
            result.edgeCount += 1;
            if (hit.intersection != null) {                
                result.stop = result.stop || (options.earlyExitPredicate && options.earlyExitPredicate(hit));
                result.hits.push({polygon, ray, edge, intersection: hit.intersection,
                    distance: distance(hit.intersection.point, ray.line[0]) * ray.cosAngle
                });
            }
        }
    }
    return result;
}

export function intersectRayEdge(edge: IEdge, ray: IRay, options: RayCastingOptions = null): RayHit {    
    
    if (options?.edgeFilter && !options.edgeFilter(edge)) { return null; }    
    const intersection = intersectRaySegment(ray, edge.segment);
    if (intersection) {
        return {
            polygon: null, ray, edge, intersection,
            distance: distance(intersection.point, ray.line[0]) * ray.cosAngle
        };    
    }    
    
    return {polygon: null, ray, edge, intersection: null, distance: 0};
}
  
export const lookupMaterialFor = (intersection: Intersection, edge: IEdge): IMaterial => intersection && getMaterial(intersection.face, edge?.material);