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
            //this.context2D.fillText(castedRays[0].distance.toString(), castedRays[0].intersection[0], castedRays[0].intersection[1])
            if (this.displayRays) {
                console.log(castedRays); this.displayRays = false;
                console.log(castedRays.map((_, i) => [this.mapToColumn(i), this.mapToColumn(i+1)]));
            }

            castedRays.forEach((c, column, a) => {
                let height = this.convertDistanceToWallHeight(c && c.distance || this.horizonDistance);
                let startRow = (this.canvas.height - height)/2;
                let endRow = (this.canvas.height + height)/2;

                let color = 100;
                if (c?.hit?.edge) {
                    let m = Math.abs(slope([c.hit.edge.start.vector, c.hit.edge.end.vector]));
                    color = isFinite(m) && m < 1 ? 255 : 100;
                }

                this.drawRect(this.context, [[this.mapToColumn(column), startRow], [this.mapToColumn(column+1), endRow]], `rgb(0,0,${color})`);
                if (c?.hit) {
                    if (c.hit.intersection) {
                        this.drawVector(this.context2D, c.hit.intersection, 'rgb(0,255,0)');
                        if (column % 20 === 0) this.drawSegment(this.context2D, [c.hit.intersection, this.world.camera.location], 'green');
                    }
                    else {
                        this.drawSegment(this.context2D, c.hit.ray.line, 'red');
                    }
                };
            });
        }
    };

    private convertDistanceToWallHeight = (d: number) => {
        return (60/d) * this.canvas.height;
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