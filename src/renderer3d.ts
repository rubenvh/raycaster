import { atan } from 'mathjs';
import { RayHit } from './geometry';
import { ILineSegment, slope } from './lineSegment';
import * as raycaster from './raycaster';
import { getX, getY, Vector } from './vector';
import { World } from './world';
export class Renderer3d {
    private context: CanvasRenderingContext2D;
    constructor(private world: World, private canvas: HTMLCanvasElement, private context2D: CanvasRenderingContext2D) {
        this.context = canvas.getContext('2d');
    }
    private resolution = 320;
    private horizonDistance = 250;
    
    private mapToColumn = (column: number) => {
        return this.canvas.width - column / this.resolution * this.canvas.width;
    }

    displayRays = true;
    public render = () => {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let castedRays = raycaster.getCastedRays(this.resolution, this.world.camera, this.world.geometry);

        if (castedRays) {
            castedRays.forEach((c, column) => {                
                c.hits.forEach(hit => {
                    let height = this.convertDistanceToWallHeight(hit.distance || this.horizonDistance);
                    let startRow = (this.canvas.height - height)/2;
                    let endRow = (this.canvas.height + height)/2;
                    let color = determineLight(hit);
    
                    // draw wall
                    this.drawRect(this.context, [[this.mapToColumn(column), startRow], [this.mapToColumn(column+1), endRow]], `rgb(0,0,${color})`);
                    
                    // TODO: store casted rays in store so we can update the 2d view there
                    if (hit?.intersection) {
                        this.drawVector(this.context2D, hit.intersection, 'rgb(0,255,0)');
                        if (column % 20 === 0) this.drawSegment(this.context2D, [hit.intersection, hit.ray.line[0]], 'green');                    
                    };
                });
                
            });
        }
    };

    private convertDistanceToWallHeight = (d: number) => {
        return (10/d) * this.canvas.height;
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

    private drawSegment = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'white') => {
        context.beginPath();
        context.moveTo(getX(segment[0]), getY(segment[0]));
        context.lineTo(getX(segment[1]), getY(segment[1]));
        context.lineWidth = 1;
        context.setLineDash([]);
        context.strokeStyle = color;
        context.stroke();
    };
}

export const determineLight = (hit: RayHit) => {
    let color = 100;
    if (hit?.edge) {
        let m = Math.abs(slope([hit.edge.start.vector, hit.edge.end.vector]));            
        if (!isFinite(m)) return 255;
        
        color += (m / (1 + m)) * (255-color);
    }
    return color;
}