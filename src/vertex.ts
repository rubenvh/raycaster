export class Vertex {
    coordinates: number[];
    constructor(...coordinates: number[]) {
        this.coordinates = coordinates;
    }
    
    dim = () => this.coordinates.length;
    
}