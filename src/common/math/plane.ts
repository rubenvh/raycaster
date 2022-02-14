import { drawVector } from "../drawing/drawing";
import { ILineSegment, slope } from "./lineSegment";
import { add, dot, normalize, perpendicular, scale, subtract, Vector } from "./vector";

export type Plane = {n: Vector, d: number};
export function createPlane(a: ILineSegment): Plane {
    const n = normalize(perpendicular(subtract(a[1], a[0])));
    return {
        n, d: dot(n, a[0])
    };    
}

export const planeSlope = (plane: Plane): number => {
    return slope([[0,0], perpendicular(plane.n)]);
}

export const isPlaneSemiHorizontal = (plane: Plane): boolean => {
    const s = Math.abs(planeSlope(plane));
    return s >= 0 && s <= 1;
}

export const getBounds = (plane: Plane, xMax: number, yMax: number): [Vector, Vector] => {    
    if (isPlaneSemiHorizontal(plane)) {
        return [[0,(plane.d)/plane.n[1]],
                [xMax, (plane.d - plane.n[0]*xMax)/plane.n[1]]];
    } else {
        return [[(plane.d)/plane.n[0], 0],
                [(plane.d - plane.n[1]*yMax)/plane.n[0], yMax]];
    }
}

export function intersectSegmentPlane(s: ILineSegment, p: Plane): {t: number, q?: Vector} {
    const [a, b] = s;
    // compute the t value for the directed line ab intersecting the plane
    const ab = subtract(b, a);
    const t = (p.d - dot(p.n, a)) / dot(p.n, ab);
    // if t in [0..1] compute and return intersection point
    if (t >= 0 && t <= 1) {
        const q = add(a, scale(t, ab));
        return ({t, q});
    }
    return ({t});
}


