import { RayHit } from './geometry';
import { ILineSegment, slope } from './lineSegment';
import * as raycaster from './raycaster';
import { getX, getY } from './vector';
import { World } from './world';

export class Renderer3d {
    private context: CanvasRenderingContext2D;
    constructor(private world: World, private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
    }
    private resolution = 1280;
    private horizonDistance = 250;
    
    public render = () => {                
        // draw floor + sky
        this.drawRect(this.context, [[0, 0], [this.canvas.width, this.canvas.height/2]], 'rgb(200,200,200)');
        this.drawRect(this.context, [[0, this.canvas.height/2], [this.canvas.width, this.canvas.height]], 'rgb(50,80,80)');
        
        this.world.rays = raycaster.getCastedRays(this.resolution, this.world.camera, this.world.geometry);
        this.world.rays.forEach((c, rayIndex) => {
            for (let index = c.hits.length; index > 0; index--) {
                const hit = c.hits[index-1];
                this.drawWall(hit, rayIndex);
            }
        });                  
    };

    private convertDistanceToWallHeight = (d: number) => {
        return (10/d) * this.canvas.height;
    }

    private mapToColumn = (column: number) => {
        return this.canvas.width - column / this.resolution * this.canvas.width;
    }

    private drawWall = (hit: RayHit, rayIndex: number) => {
        let height = this.convertDistanceToWallHeight(hit.distance || this.horizonDistance);
        let startRow = (this.canvas.height - height)/2;
        let endRow = (this.canvas.height + height)/2;
        let color = determineColor(hit);                    

        let [col1, col2] = [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex+1)];
                    
        // draw selection borders if edge was selected
        if (this.world.selection.includes(hit.edge))
        {
            this.drawRect(this.context, [[col1, startRow-2], [col2, startRow]], 'rgb(250,100,0)');
            this.drawRect(this.context, [[col1, endRow], [col2, endRow+2]], 'rgb(250,100,0)');
        }                            
        this.drawRect(this.context, [[col1, startRow], [col2, endRow]], color);
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

const determineColor = (hit: RayHit) => {
    const luminosity = determineLight(hit);
    if (hit?.edge?.material?.color) {
        const color = hit.edge.material.color.map((c, i) => i === 3 ? c : c/255 * luminosity);
        return `rgba(${color.join()})`;
    }
    return `rgb(0,0,${luminosity})`;
};
export const determineLight = (hit: RayHit) => {
    let color = 100;
    if (hit?.edge) {
        let m = Math.abs(slope([hit.edge.start.vector, hit.edge.end.vector]));            
        if (!isFinite(m)) return 255;
        
        color += (m / (1 + m)) * (255-color);
    }
    return color;
}