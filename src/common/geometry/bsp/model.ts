import { IPolygon } from './../polygon';
import { ILineSegment } from './../../math/lineSegment';
import { dot, normalize, perpendicular, subtract, Vector } from './../../math/vector';

export type IBSPNode  = {};
export type Plane = {n: Vector, d: number};
export function createPlane(a: ILineSegment): Plane {
    const n = normalize(perpendicular(subtract(a[1], a[0])));
    return {
        n, d: dot(n, a[0])
    };    
}

export enum PointToPlaneRelation {
    InFront,
    Behind,
    On
}
export enum PolygonToPlaneRelation {
    InFront,
    Behind,
    Straddling,
    Coplanar
}
const PLANE_THICKNESS_EPSILON = Number.EPSILON;
export function classifyPointToPlane(p: Vector, plane: Plane): PointToPlaneRelation {
    const dist = dot(plane.n, p) - plane.d;
    return dist > PLANE_THICKNESS_EPSILON ? PointToPlaneRelation.InFront
    : dist < -PLANE_THICKNESS_EPSILON ? PointToPlaneRelation.Behind
    : PointToPlaneRelation.On;
}
/**
 * Return value specifying whether the polygon lies in front of, behind of, on, or straddles the plane.
 */
export function classifyPolygonToPlane(polygon: IPolygon, plane: Plane): PolygonToPlaneRelation {
    let [numInFront, numBehind] = [0,0];    

    for (const vertex of polygon.vertices) {
        switch (classifyPointToPlane(vertex.vector, plane)) {
            case PointToPlaneRelation.InFront:
                numInFront++;
                break;
            case PointToPlaneRelation.Behind:
                numBehind++;
                break;
        }        
    }

    if (numBehind != 0 && numInFront != 0) { return PolygonToPlaneRelation.Straddling; }
    if (numInFront != 0) { return PolygonToPlaneRelation.InFront };
    if (numBehind != 0) { return PolygonToPlaneRelation.Behind; }
    return PolygonToPlaneRelation.Coplanar;
}