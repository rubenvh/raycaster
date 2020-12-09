import { makeRays } from './camera';
import { RayHit } from './geometry/geometry';
import { ILineSegment, slope } from './geometry/lineSegment';
import * as raycaster from './raycaster';
import { isSelectedEdge, World } from './world';
import { drawRect } from './drawing/drawing';
import { Guid } from 'guid-typescript';

type WallProps = {
    edgeId: Guid,
    height: number, 
    color: string, 
    rowRange: [number, number], 
    colRange: [number,number]
};
type ZBuffer = Map<Guid,WallProps[]>[];
export class Renderer3d {
    private context: CanvasRenderingContext2D;
    // private floorSky: ImageData;
    private width: number;
    private height: number;

    constructor(private world: World, private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // this.floorSky = this.context.createImageData(this.width, this.height);        
        // let floorSkyPixels = this.floorSky.data;
        // this.rect(floorSkyPixels, 0,0,this.width, this.height/2, [200,200,200, 255]);
        // this.rect(floorSkyPixels, 0, this.height/2,this.width, this.height, [50,80,80, 255]);
        // this.context.putImageData(this.floorSky,0,0);
    }
    private resolution = 1280;
    private horizonDistance = 250;
    
    private createWall = (hit: RayHit, rayIndex: number): WallProps => {
        const height = this.convertDistanceToWallHeight(hit.distance || this.horizonDistance);                    
        const startRow = Math.floor((this.height - height)/2);
        const endRow = Math.floor((this.height + height)/2);
        const edgeId = hit.edge && hit.edge.id || Guid.createEmpty();

        return ({edgeId, height, 
            color: determineColor(hit),
            rowRange: [startRow, endRow],
            colRange: [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex+1)]
        });
    };
    public render = () => {                   
        // draw floor + sky
        drawRect(this.context, [[0, 0], [this.canvas.width, this.canvas.height/2]], 'rgb(200,200,200)');
        drawRect(this.context, [[0, this.canvas.height/2], [this.canvas.width, this.canvas.height]], 'rgb(50,80,80)');

        this.world.rays = raycaster.castRays(makeRays(this.resolution, this.world.camera), this.world.geometry, raycaster.passTroughTranslucentEdges);
        
        // construct a z-index buffer: 
        const zbuffer = this.constructZBuffer(this.world.rays);
        
        // draw the z-buffer => farthest to closest 
        this.drawZBuffer(zbuffer);
    };

    /**
     * This function loops the rays iteratively and constructs wall properties for all the closest ray hits and groups them by edge.
     * It then continues with the 2nd closest and so on until we reach the farthest ray hits.
     * Grouping by edge allows us to draw a wall in 1 go completely instead of per column. 
     */
    private constructZBuffer = (rays: raycaster.CastedRay[]): ZBuffer => {
        const zbuffer: ZBuffer = [];
        const indexes = rays.map(r => r.hits.length);
        const max = Math.max(...indexes);
        for (let i = 0; i < max; i++) {

            const groupedByEdge = rays.reduce(
                (acc, r, rayIndex) => {
                    if (i > indexes[rayIndex]-1) { return acc; }
                    const wall = this.createWall(r.hits[i], rayIndex);                    
                    return acc.set(wall.edgeId, [...acc.get(wall.edgeId)||[], wall]);                    
                }, new Map<Guid, WallProps[]>());

            zbuffer.push(groupedByEdge);
        }
        return zbuffer;
    };

    /**
     * This function iteratively pops the zbuffer drawing walls farthest to closest.
     * Because wall properties are grouped by edge we can quickly draw multiple columns in 1 go.     
     */
    private drawZBuffer = (zbuffer: ZBuffer) => {
        while (zbuffer.length > 0) {
            const z = zbuffer.pop();
            z.forEach((wallProps, edgeId) => {
                if (wallProps.length === 0) return;
                if (wallProps.length === 1) {
                    const w = wallProps[0];
                    drawRect(this.context, [[w.colRange[0], w.rowRange[0]], [w.colRange[1], w.rowRange[1]]], w.color);
                } else {
                    this.drawWall(wallProps);           
                }
            } );
        }  
    };

    private convertDistanceToWallHeight = (d: number) => 10 * this.height / d;
    private mapToColumn = (column: number) => Math.floor(this.width - column * this.width / this.resolution);

    private drawWall = (wallProps: WallProps[]) => {
        const start = wallProps[0];
        const end = wallProps[wallProps.length-1];
        this.context.fillStyle = wallProps[0].color;
        this.context.beginPath();
        this.context.moveTo(start.colRange[0], start.rowRange[0]);
        this.context.lineTo(start.colRange[0], start.rowRange[1]);
        this.context.lineTo(end.colRange[1], end.rowRange[1]);
        this.context.lineTo(end.colRange[1], end.rowRange[0]);
        this.context.closePath();
        this.context.fill();

        // // draw selection borders if edge was selected
        // if (isSelectedEdge(hit.edge, this.world.selection)) {
        //      drawRect(this.context, [[col1, startRow-2], [col2, startRow]], 'rgb(250,100,0)');
        //      drawRect(this.context, [[col1, endRow], [col2, endRow+2]], 'rgb(250,100,0)');
        // }        
    };
}

const determineColor = (hit: RayHit) => {
    const luminosity = determineLight(hit);        
    if (hit?.edge?.material?.color) {        
        const color = hit.edge.material.color;
        return `rgba(${color[0]/255 * luminosity},${color[1]/255 * luminosity},${color[2]/255 * luminosity},${color[3]})`;
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
};
