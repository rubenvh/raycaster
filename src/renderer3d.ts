import { ILineSegment } from './lineSegment';
import * as raycaster from './raycaster';
import { getX, getY, Vector } from './vector';
import { World } from './world';
export class Renderer3d {
    private context: CanvasRenderingContext2D;
    constructor(private world: World, private canvas: HTMLCanvasElement, private context2D: CanvasRenderingContext2D) {
        this.context = canvas.getContext('2d');        
    }
    private resolution = 320; 
    private horizonDistance = 500;
    private mapColumn = (i: number) => this.canvas.width - i / this.resolution * this.canvas.width;

    public render = () => {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);    
        let castedRays = raycaster.getCastedRays(this.resolution, this.world.camera, this.world.geometry);
               
        if (castedRays) {
            //this.context2D.fillText(castedRays[0].distance.toString(), castedRays[0].intersection[0], castedRays[0].intersection[1])
        
            castedRays.forEach((c, column) => {                
                // TODO: determine height of wall based on casted ray results (distance to camera screen)
                let height = this.convertDistanceToWallHeight((c && c.distance) || this.horizonDistance);
                let startRow = (this.canvas.height - height)/2;
                let endRow = (this.canvas.height + height)/2;           

                // TODO: draw rectangel column to mapped column (= 2 pixels wide)
                this.drawRect(this.context, [[this.mapColumn(column), startRow], [this.mapColumn(column+1), endRow]]);
                if (c) this.drawVector(this.context2D, c.intersection, 'purple');        
                
            });
        }

    };

    private convertDistanceToWallHeight = (d: number) => {        
        return d >= this.horizonDistance ? 1            
            : Math.max(1, (this.canvas.height - (this.canvas.height/this.horizonDistance)*d));
    }

    private drawVector = (context: CanvasRenderingContext2D, vector: Vector, color: string = 'red') => {
        context.beginPath();
        context.arc(getX(vector), getY(vector), 2, 0, 2*Math.PI, false);
        context.fillStyle = color;
        context.fill();
    }
    private drawRect = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'rgb(0,0,255)') => {
        const x1 = getX(segment[0]),
              y1 = getY(segment[0]),
              x2 = getX(segment[1]),
              y2 = getY(segment[1]);
        context.beginPath();                
        context.fillStyle = color;
        context.fillRect(x1, y1, x2-x1, y2-y1);
    };
}