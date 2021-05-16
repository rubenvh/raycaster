import { ILineSegment } from "./lineSegment";
import { add, dot, normalize, perpendicular, scale, subtract, Vector } from "./vector";

export type Plane = {n: Vector, d: number};
export function createPlane(a: ILineSegment): Plane {
    const n = normalize(perpendicular(subtract(a[1], a[0])));
    return {
        n, d: dot(n, a[0])
    };    
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