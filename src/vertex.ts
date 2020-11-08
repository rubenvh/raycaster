import { create, all } from 'mathjs'

const config = { }
export const math = create(all, config)
export class Vertex {
    coordinates: number[];
    constructor(...coordinates: number[]) {
        this.coordinates = coordinates;
    }
    
    get x() { return this.coordinates[0]};
    get y() { return this.coordinates[1]};

    dim = () => this.coordinates.length;    
    scale = (factor: number) => new Vertex(...this.coordinates.map(_ => factor * _));
    subtract = (other: Vertex) => new Vertex(...this.coordinates.map((_, i) => _ - other.coordinates[i]));  
    add = (other: Vertex) => new Vertex(...this.coordinates.map((_, i) => _ + other.coordinates[i]));
    rotate = (angle: number) => 
        new Vertex(...math.multiply(createRotation(angle), this.coordinates) as any as number[]);
}

export const createRotation = (angle: number) => [
    [math.cos(angle), -1 * math.sin(angle)],
    [math.sin(angle), math.cos(angle)]
];
