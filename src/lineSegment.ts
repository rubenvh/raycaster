import { Vector } from './vector';
export class LineSegment {
    points: [Vector, Vector];
    constructor(p1: Vector, p2: Vector) {
        this.points = [p1, p2];
    }
    get start() { return this.points[0]; }
    ;
    get end() { return this.points[1]; }
    ;
}
