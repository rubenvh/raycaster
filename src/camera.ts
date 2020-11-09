import { Vertex, math } from './vertex';
import { Segment } from "./segment";
export class Camera {
    private _screen: Segment;
    constructor(private location: Vertex, private target: Vertex, private angle: number = math.pi / 4) {
        this.setConfig({angle});
        this.change();
    }
    
    get screen() { return this._screen; }
    get config() { return ({angle: this.angle}); }
    adaptAngle = (direction: 1|-1) => this.setConfig({angle: this.angle+direction*0.05});
    adaptDepth = (direction: 1|-1) => this.change(() => {
        let delta = this.target.subtract(this.location).scale(direction*0.01);        
        this.target = this.target.add(delta);
    });
    makeRays = (resolution: number) => { 
        const base = this.screen.end.subtract(this.screen.start);
        return Array.from(Array(resolution+1).keys())
            .map(i => i/resolution)
            .map(factor => new Segment(this.location, this._screen.start.add(base.scale(factor))
        ));
    };
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
        if (changer) {
            changer();
        }
        this._screen = this.makeScreen();
    };

    private setConfig = (config: {angle:number}) => {        
        this.angle = config.angle <= math.pi/8 ? math.pi/8 : (config.angle >= (3/8)*math.pi ? (3/8)*math.pi : config.angle);
        this.change();
    };
    

    private makeScreen = (): Segment => {
        let d = this.target.subtract(this.location);
        return new Segment(
            this.location.add(d.rotate(this.angle)),
            this.location.add(d.rotate(-1 * this.angle)));
    };
}
