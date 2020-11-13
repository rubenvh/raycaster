import { OldVector } from './vector';
export class LineSegment {
    points: [OldVector, OldVector];
    constructor(p1: OldVector, p2: OldVector) {
        this.points = [p1, p2];
    }
    get start() { return this.points[0]; }
    ;
    get end() { return this.points[1]; }
    ;
}
