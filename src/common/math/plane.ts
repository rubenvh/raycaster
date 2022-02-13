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

//Since we have 3 possible outcomes, a short will be used to return either 0, 1 or 2
//This can be replaced with just a bool, depending on how the special case (point on plane) wants to be handled
export function halfSpaceTest(point: Vector, plane: Plane) {
    const [[x1, y1], [x2, y2]] = getBounds(plane, 1, 1);
    //Calculate a vector from the point on the plane to our test point
    const temp = subtract(point, [x1, y1]);
    //Calculate the distance: dot product of the new vector with the plane's normal
    const fdist = dot(temp, plane.n)
    if(fdist > Number.EPSILON) {
        //Point is in front of the plane
        return 0;
    } else if(fdist < -Number.EPSILON) {
        //Point is behind the plane
        return 1;
    } 
    //If neither of these were true, then the point is on the plane
    return 2;
} 

