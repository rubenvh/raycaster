import { add, distance, angleBetween, cross, dot, getX, getY, norm, normalize, normSqr, perpendicular, scale, subtract, Vector } from './vector';

export type ILine = [Vector, Vector]; // or other representations
export type ILineSegment = [Vector, Vector];
export type IRay = {line: ILine, angle: number}; 

const start = (a: ILineSegment): Vector => a[0];
const end = (a: ILineSegment): Vector => a[1];

export const midpoint = (a: ILineSegment): Vector => [(a[0][0]+a[1][0])/2, (a[0][1]+a[1][1])/2];
export const slope = (s: ILineSegment): number => {
  const [x1, x2] = [s[0][0], s[1][0]];
  const [y1, y2] = [s[0][1], s[1][1]];
  return (y2-y1)/(x2-x1);
};

export const lineAngle = (a: ILineSegment, b: ILineSegment): number => {
  return angleBetween(
    subtract(a[1], a[0]),
    subtract(b[1], b[0]));
}
const intersectSegments = (a: ILineSegment, b: ILineSegment): Vector => {
    const p0_x = a[0][0];
    const p0_y = a[0][1];
    const p1_x = a[1][0];
    const p1_y = a[1][1];
    const p2_x = b[0][0];
    const p2_y = b[0][1];
    const p3_x = b[1][0];
    const p3_y = b[1][1];
   
    const s1_x = p1_x - p0_x;
    const s1_y = p1_y - p0_y;
    const s2_x = p3_x - p2_x;
    const s2_y = p3_y - p2_y;
    
    const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = ( s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
    {  
        return [p0_x + (t * s1_x), p0_y + (t * s1_y)];
    }
    return null;    
};

export const lineIntersect = (a: ILine, b: ILine): Vector => {
  let A1 = a[1][1]-a[0][1], //p1y - p0y,
      B1 = a[0][0]-a[1][0], //p0x - p1x,
      C1 = A1 * a[0][0] + B1 * a[0][1], //p0x + B1 * p0y,
      A2 = b[1][1]-b[0][1], //p3y - p2y,
      B2 = b[0][0]-b[1][0], //p2x - p3x, 
      C2 = A2 * b[0][0] + B2 * b[0][1], //A2 * p2x + B2 * p2y,
      denominator = A1 * B2 - A2 * B1;

    return [(B2 * C1 - B1 * C2) / denominator, (A1 * C2 - A2 * C1) / denominator];
};

export const intersectRay = (ray: IRay, s: ILineSegment): Vector => {
  let a = s[0];
  let b = s[1];
  let o = ray.line[0];  
  let v1 = subtract(o, a);
  let v2 = subtract(b, a);
  let rd = normalize(subtract(ray.line[1], o));     
  let v3 = [-rd[1], rd[0]];
  let t1 = cross(v2, v1)/dot(v2, v3);
  let t2 = dot(v1, v3)/dot(v2, v3);
  
  if (t1 >=  0 && t2 >= 0 && t2 <= 1) return add(o, scale(t1, rd));
  return null;
}

export const distanceTo = (p: Vector, s: ILineSegment): number => {
  let v = s[0], w = s[1];
  let l2 = normSqr(subtract(v, w));
  if (l2 === 0) return normSqr(subtract(p, v));
  let wv = subtract(w,v);
  let t = dot(subtract(p, v), wv) / l2;
  t = Math.max(0, Math.min(1, t));
  return norm(subtract(p, add(v, scale(t, wv))));
};
export const distanceToMidPoint = (p: Vector, s: ILineSegment): number => distance(p, midpoint(s));