import { perpDot, subtract, Vector } from './vector';

export type ILine = [Vector, Vector]; // or other representations
export type ILineSegment = [Vector, Vector];

const slope = (s: ILineSegment): number => {
  const [x1, x2] = [s[0][0], s[1][0]];
  const [y1, y2] = [s[0][1], s[1][1]];
  return (y2-y1)/(x2-x1);
};
const isOn = (v: Vector, s: ILineSegment): boolean => {
  const m = slope(s);
  const colinear = (v[1]-s[0][1]) - (m * (v[0]-s[0][0])) < 0.001;
  const between = (Math.min(s[0][0], s[1][0]) <= v[0] && v[0] <= Math.max(s[0][0], s[1][0])) 
              && (Math.min(s[0][1], s[1][1]) <= v[1] && v[1] <= Math.max(s[0][1], s[1][1]))

  return colinear && between;
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

export const intersectLineWithSegment = (a: ILine, b: ILineSegment): Vector => {
    const x1 = a[0][0];
    const y1 = a[0][1];
    const x2 = a[1][0];
    const y2 = a[1][1];
    const x3 = b[0][0];
    const y3 = b[0][1];
    const x4 = b[1][0];
    const y4 = b[1][1];

    // Check if none of the lines are of length 0
	if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
		return null;
	}

	const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

  // Lines are parallel
	if (denominator === 0) {
		return null;
	}

	let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
	let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

  // is the intersection along the segments
	if (ua < 0 || ub < 0) {
	 	return null;
	}

  // Return a object with the x and y coordinates of the intersection
	let x = x1 + ua * (x2 - x1)
  let y = y1 + ua * (y2 - y1)
  return [x, y];
    //return isOn([x,y], b) ? [x,y] : null;
}