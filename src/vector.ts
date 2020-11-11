import { create, all } from 'mathjs'

const config = { }
export const math = create(all, config)
export class Vector {
    coordinates: number[];
    constructor(...coordinates: number[]) {
        this.coordinates = coordinates;
    }
    
    get x() { return this.coordinates[0]};
    get y() { return this.coordinates[1]};

    dim = () => this.coordinates.length;    
    norm = () => math.sqrt(this.dot(this));
    dot = (v: Vector) => this
        .zip(v, (xu, xv) => xu * xv)
        .reduce((acc, n) => acc + n, 0);
    scale = (k: number) => new Vector(...this.coordinates.map(x => k * x));
    subtract = (v: Vector) => new Vector(...this.zip(v, (xu, xv) => xu - xv));
    add = (v: Vector) => new Vector(...this.zip(v, (xu, xv) => xu + xv));
    rotate = (angle: number) => 
        new Vector(...math.multiply(createRotation(angle), this.coordinates) as any as number[]);
    
    isOrthogonalTo = (v: Vector) => this.dot(v) === 0;
    distanceTo = (v: Vector) => this.subtract(v).norm();
    angleWith = (v: Vector) => math.acos(this.dot(v) / (this.norm() * v.norm()));
    proj = (v: Vector) => v.scale(this.dot(v) / v.dot(v));

    private zip = (other: Vector, acc: (x: number, y: number)=>number): number[] => {
        return this.coordinates.map((_, i) => acc(_, other.coordinates[i]));
    }
}

export const createRotation = (angle: number) => [
    [math.cos(angle), -1 * math.sin(angle)],
    [math.sin(angle), math.cos(angle)]
];
