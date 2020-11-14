import { Vector, math, subtract, scale, add, rotate } from './vector';
import { LineSegment } from "./lineSegment";
export class Camera {
    private _screen: LineSegment;
    constructor(private location: Vector, private target: Vector, private angle: number = math.pi / 4) {
        this.adaptAngle(0);
    }
    
    get screen() { return this._screen; }
    get config() { return ({angle: this.angle}); }
    adaptAngle = (direction: 0|1|-1) => this.change(() => {
        const newAngle = this.angle+direction*0.05;
        this.angle = newAngle <= math.pi/8 ? math.pi/8 : (newAngle >= (3/8)*math.pi ? (3/8)*math.pi : newAngle);
    });
    adaptDepth = (direction: 1|-1) => this.change(() => {
        let delta = scale(direction*0.01, subtract(this.target, this.location));        
        this.target = add(this.target, delta);
    });    
    move = (ratio: number) => this.change(() => {
        let delta = scale(ratio, subtract(this.target, this.location));
        this.location = add(this.location, delta);
        this.target = add(this.target, delta);
    });
    rotate = (angle: number) => this.change(() => {
        let d = subtract(this.target, this.location);
        this.target = add(this.location, rotate(angle, d));
    });
    strafe = (ratio: number) => this.change(() => {
        let d = subtract(this.target, this.location);
        let sign = ratio > 0 ? 1 : -1;
        let n = scale(math.abs(ratio), rotate(sign * math.pi/2, d));
        this.location = add(this.location, n);
        this.target = add(this.target, n);
    });

    private change = (changer: () => void = null) => {
        if (changer) { changer(); }
        this._screen = this.makeScreen();
    };

    private makeScreen = (): LineSegment => {
        let d = subtract(this.target, this.location);
        return new LineSegment(
            add(this.location, rotate(this.angle, d)),
            add(this.location, rotate(-1 * this.angle, d)));
    };

    makeRays = (resolution: number) => { 
        const base = subtract(this.screen.end, this.screen.start);
        return Array.from(Array(resolution+1).keys())
            .map(i => i/resolution)
            .map(factor => new LineSegment(this.location, add(this._screen.start, scale(factor, base))));
    };
}
