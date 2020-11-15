import { ILineSegment } from './lineSegment';
import * as raycaster from './raycaster';
import { getX, getY } from './vector';
import { World } from './world';
export class Renderer3d {
    private context: CanvasRenderingContext2D;
    constructor(private world: World, private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');        
    }
    private resolution = 320;
    private mapColumn = (i: number) => i / this.resolution * this.canvas.width;

    public render = () => {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);    
        let castedRays = raycaster.getCastedRays(this.resolution, this.world.camera, this.world.geometry);
        castedRays.forEach((c, column) => {
            // TODO: determine height of wall based on casted ray results (distance to camera screen)
            let height = Math.random()*this.canvas.height;
            let startRow = this.canvas.height - height;
            let endRow = this.canvas.height - startRow;

            // TODO: draw rectangel column to mapped column (= 2 pixels wide)
            this.drawSegment(this.context, [[this.mapColumn(column), startRow], [this.mapColumn(column), endRow]]);
        });

    };

    private drawSegment = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'blue') => {
        context.beginPath();
        context.moveTo(getX(segment[0]), getY(segment[0]));
        context.lineTo(getX(segment[1]), getY(segment[1]));
        context.lineWidth = 1;
        context.setLineDash([]);
        context.strokeStyle = color;
        context.stroke();
    };
}