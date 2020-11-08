import { Vertex, math } from './vertex';
import { Segment } from "./segment";
export class Camera {
    private _screen: [Vertex, Vertex];
    constructor(private location: Vertex, private direction: Vertex, private angle: number = math.pi / 4) {
        if (angle <= 0 || angle >= math.pi)
            throw new Error('camera angle should be positive number smaller than pi.');
        this.change();
    }
    get screen() { return this._screen; }
    makeRays = (resolution: number) => { 
        const base = this.screen[1].subtract(this.screen[0]);
        return math.range(0, resolution).map(i => new Segment(
            this.location,
            this.screen[0].add(base.scale(1/i))
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
    private makeScreen = (): [Vertex, Vertex] => {
        let d = this.direction.subtract(this.location);
        return [
            this.location.add(d.rotate(this.angle)),
            this.location.add(d.rotate(-1 * this.angle))
        ];
    };
}
