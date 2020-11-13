import { OldVector, math } from './vector';
import { LineSegment } from "./lineSegment";
export class Camera {
    private _screen: LineSegment;
    constructor(private location: OldVector, private target: OldVector, private angle: number = math.pi / 4) {
        this.adaptAngle(0);
    }
    
    get screen() { return this._screen; }
    get config() { return ({angle: this.angle}); }
    adaptAngle = (direction: 0|1|-1) => this.change(() => {
        const newAngle = this.angle+direction*0.05;
        this.angle = newAngle <= math.pi/8 ? math.pi/8 : (newAngle >= (3/8)*math.pi ? (3/8)*math.pi : newAngle);
    });
    adaptDepth = (direction: 1|-1) => this.change(() => {
        let delta = this.target.subtract(this.location).scale(direction*0.01);        
        this.target = this.target.add(delta);
    });    
    move = (ratio: number) => this.change(() => {
        let delta = this.target.subtract(this.location).scale(ratio);
        this.location = this.location.add(delta);
        this.target = this.target.add(delta);
    });
    rotate = (angle: number) => this.change(() => {
        let d = this.target.subtract(this.location);
        this.target = this.location.add(d.rotate(angle));
    });
    strafe = (ratio: number) => this.change(() => {
        let d = this.target.subtract(this.location);
        let sign = ratio > 0 ? 1 : -1;
        let n = d.rotate(sign * math.pi/2).scale(math.abs(ratio));
        this.location = this.location.add(n);
        this.target = this.target.add(n);
    });

    private change = (changer: () => void = null) => {
        if (changer) { changer(); }
        this._screen = this.makeScreen();
    };

    private makeScreen = (): LineSegment => {
        let d = this.target.subtract(this.location);
        return new LineSegment(
            this.location.add(d.rotate(this.angle)),
            this.location.add(d.rotate(-1 * this.angle)));
    };

    makeRays = (resolution: number) => { 
        const base = this.screen.end.subtract(this.screen.start);
        return Array.from(Array(resolution+1).keys())
            .map(i => i/resolution)
            .map(factor => new LineSegment(this.location, this._screen.start.add(base.scale(factor))
        ));
    };
}
