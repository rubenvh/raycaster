import { create, all } from 'mathjs'

const config = { }
const math = create(all, config)
export class Vertex {
    coordinates: number[];
    constructor(...coordinates: number[]) {
        this.coordinates = coordinates;
    }
    
    get x() { return this.coordinates[0]};
    get y() { return this.coordinates[1]};

    dim = () => this.coordinates.length;    
    vec = (target: Vertex) => new Vertex(target.x - this.x, target.y - this.y);    
    translate = (arg: Vertex) => new Vertex(...this.coordinates.map((_, i) => _ + arg[i]));
    lmult = (arg: number[][]) => 
        new Vertex(...math.multiply(arg, this.coordinates) as any as number[]);
}

export class Camera {
    private _screen: [Vertex, Vertex]
    constructor(private origin: Vertex, private direction: Vertex) {
        this._screen = this.makeScreen();
    }

    get screen() { return this._screen; };

    private makeScreen = (): [Vertex, Vertex] => {
        let od = this.origin.vec(this.direction);
        let m = this.origin.translate(od.lmult(this.createRotationMatrix(math.pi/4)));

        // let m: number[] = math.add(
        //     this.origin.coordinates, 
        //     math.multiply(this.createRotationMatrix(math.pi/4), od.coordinates)) as any as number[];
        let n: number[] = math.add(
            this.origin.coordinates,  
            math.multiply(this.createRotationMatrix(-1 * math.pi / 4), od.coordinates)) as any as number[];
        return [m, new Vertex(...n)];
    }

    private createRotationMatrix = (angle: number) => [
        [math.cos(angle), -1 * math.sin(angle)],
        [math.sin(angle), math.cos(angle)]
    ];


}