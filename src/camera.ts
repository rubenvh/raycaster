import { Vertex, math } from './vertex';
import { Segment } from "./segment";
export class Camera {
    private _screen: Segment;
    constructor(private location: Vertex, private direction: Vertex, private angle: number = math.pi / 4) {
        if (angle <= 0 || angle >= math.pi)
            throw new Error('camera angle should be positive number smaller than pi.');
        this.change();
    }
    get screen() { return this._screen; }
    makeRays = (resolution: number) => { 
        const base = this.screen.end.subtract(this.screen.start);
        return Array.from(Array(resolution+1).keys())
            .map(i => i/resolution)
            .map(factor => new Segment(this.location, this._screen.start.add(base.scale(factor))
        ));
    };
    move = (ratio: number) => this.change(() => {
        let d = this.direction.subtract(this.location);
        this.location = this.location.add(d.scale(ratio));
    });
    rotate = (angle: number) => this.change(() => {
        let d = this.direction.subtract(this.location);
        this.direction = this.location.add(d.rotate(angle));
    });

    private change = (changer: () => void = null) => {
        if (changer) {
            changer();
        }
        this._screen = this.makeScreen();
    };
    private makeScreen = (): Segment => {
        let d = this.direction.subtract(this.location);
        return new Segment(
            this.location.add(d.rotate(this.angle)),
            this.location.add(d.rotate(-1 * this.angle)));
    };
}
