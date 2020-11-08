import { Vertex } from './vertex';
export class Segment {
    points: [Vertex, Vertex];
    constructor(p1: Vertex, p2: Vertex) {
        this.points = [p1, p2];
    }
    get start() { return this.points[0]; }
    ;
    get end() { return this.points[1]; }
    ;
}
