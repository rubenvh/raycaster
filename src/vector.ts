import { create, all } from 'mathjs'

const config = { }
export const math = create(all, config)

export type Vector = number[];

const x = (u: Vector) => u[0];
const y = (u: Vector) => u[1];
const dim = (u: Vector) => u.length;
const zip = (acc: (coordinates: number[]) => number, us: Vector[]): number[] => us[0].map((_, i, u) => acc(us.map(u => u[i])));;

const dot = (u: Vector, v: Vector) => 
    zip(cs => cs.reduce((acc, c) => acc * c, 1), [u, v])
    .reduce((acc, n) => acc + n, 0);    
const norm = (u: Vector) => math.sqrt(dot(u, u));
const scale = (k: number, u: Vector) => u.map(x => k * x);
const subtract = (u: Vector, v: Vector) => zip((cs) => cs.slice(1).reduce((acc, c) => acc - c, cs[0]), [u, v]);
const add = (u: Vector, v: Vector) => zip((cs) => cs.reduce((acc, c) => acc + c, 0), [u, v]);
const areOrthogonal = (u: Vector, v: Vector) => dot(u, v) === 0;
const distance = (u: Vector, v: Vector) => norm(subtract(u, v));
const angleBetween = (u: Vector, v: Vector) => math.acos(dot(u, v) / (norm(u) * norm(v)));
const proj = (u: Vector, v: Vector) => scale(dot(u, v) / dot(v, v), v);

export class OldVector {
    coordinates: number[];
    constructor(...coordinates: number[]) {
        this.coordinates = coordinates;
    }
    
    get x() { return this.coordinates[0]};
    get y() { return this.coordinates[1]};

    dim = () => this.coordinates.length;    
    norm = () => math.sqrt(this.dot(this));
    dot = (v: OldVector) => this
        .zip(v, (xu, xv) => xu * xv)
        .reduce((acc, n) => acc + n, 0);
    scale = (k: number) => new OldVector(...this.coordinates.map(x => k * x));
    subtract = (v: OldVector) => new OldVector(...this.zip(v, (xu, xv) => xu - xv));
    add = (v: OldVector) => new OldVector(...this.zip(v, (xu, xv) => xu + xv));
    rotate = (angle: number) => 
        new OldVector(...math.multiply(createRotation(angle), this.coordinates) as any as number[]);
    
    isOrthogonalTo = (v: OldVector) => this.dot(v) === 0;
    distanceTo = (v: OldVector) => this.subtract(v).norm();
    angleWith = (v: OldVector) => math.acos(this.dot(v) / (this.norm() * v.norm()));
    proj = (v: OldVector) => v.scale(this.dot(v) / v.dot(v));

    private zip = (other: OldVector, acc: (x: number, y: number)=>number): number[] => {
        return this.coordinates.map((_, i) => acc(_, other.coordinates[i]));
    }
}

export const createRotation = (angle: number) => [
    [math.cos(angle), -1 * math.sin(angle)],
    [math.sin(angle), math.cos(angle)]
];
