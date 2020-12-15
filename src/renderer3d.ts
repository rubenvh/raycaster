import { makeRays } from './camera';
import { slope } from './math/lineSegment';
import * as raycaster from './raycaster';
import { World } from './world';
import { drawRect } from './drawing/drawing';
import { Guid } from 'guid-typescript';
import { RayHit } from './geometry/collision';
import { distance, Vector } from './math/vector';
import { IMaterial } from './geometry/properties';

type WallProps = {
    edgeId: Guid,
    height: number, 
    material: IMaterial,
    intersection: Vector,
    origin: Vector,
    length: number,
    rowRange: [number, number], 
    colRange: [number,number]
};
type ZBuffer = Map<Guid,WallProps[]>[];
export class Renderer3d {
    private context: CanvasRenderingContext2D;
    // private floorSky: ImageData;
    private width: number;
    private height: number;
    private textures: HTMLCanvasElement;
    textureContext: CanvasRenderingContext2D;

    constructor(private world: World, private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // load some test textures from the web
        const imgUrl = 'https://filecache.garrysmods.org/2373/2/1024x768.jpg';
        this.textures = document.createElement('canvas') as HTMLCanvasElement;

        this.textureContext = this.textures.getContext('2d');
        this.textures.width = 1024; this.textures.height= 768;
        const img = new Image();
        img.onload = () => this.textureContext.drawImage(img, 0, 0);
        img.src = imgUrl;


        // this.floorSky = this.context.createImageData(this.width, this.height);        
        // let floorSkyPixels = this.floorSky.data;
        // this.rect(floorSkyPixels, 0,0,this.width, this.height/2, [200,200,200, 255]);
        // this.rect(floorSkyPixels, 0, this.height/2,this.width, this.height, [50,80,80, 255]);
        // this.context.putImageData(this.floorSky,0,0);
    }
    private resolution = 640;
    private horizonDistance = 250;
    
    private createWall = (hit: RayHit, rayIndex: number): WallProps => {
        const height = this.convertDistanceToWallHeight(hit.distance || this.horizonDistance);                    
        const startRow = Math.floor((this.height - height)/2);
        const endRow = Math.floor((this.height + height)/2);
        const edgeId = hit.edge && hit.edge.id || Guid.createEmpty();


        return ({edgeId, height, 
            material: hit.edge && {...hit.edge.material, luminosity: determineLight(hit)},
            rowRange: [startRow, endRow],
            colRange: [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex+1)],
            intersection: hit.intersection,
            origin: hit.edge?.start.vector,
            length: hit.edge && distance(hit.edge.start.vector, hit.edge.end.vector),
            
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
            z.forEach((wallProps, ) => {
                if (wallProps.length === 0) return;
                // if (wallProps.length === 1) {
                //     const w = wallProps[0];
                //     drawRect(this.context, [[w.colRange[0], w.rowRange[0]], [w.colRange[1], w.rowRange[1]]], w.color);
                // } else {
                    this.drawWall(wallProps);           
                //}
            } );
        }  
    };

    private convertDistanceToWallHeight = (d: number) => 10 * this.height / d;
    private mapToColumn = (column: number) => Math.floor(this.width - column * this.width / this.resolution);

    private drawWall = (wallProps: WallProps[]) => {        
        const start = wallProps[wallProps.length-1];
        const end = wallProps[0];        
        if (start.height <= 0) return;
        if (!start.material?.texture) {
            this.context.fillStyle = determineColor(wallProps[0].material);
            this.context.beginPath();
            this.context.moveTo(start.colRange[1], start.rowRange[0]);
            this.context.lineTo(start.colRange[1], start.rowRange[1]);
            this.context.lineTo(end.colRange[0], end.rowRange[1]);
            this.context.lineTo(end.colRange[0], end.rowRange[0]);
            this.context.closePath();
            this.context.fill();
        } else {            
            const tileFactor = 20 // => w.length for stretching
            const twidth = 192;
            const theight = 192;
            const textureIndex = 1;            
            for(let windex=wallProps.length-1; windex >= 0;windex--) {
                const w = wallProps[windex];
                const wx = distance(w.origin, w.intersection);
                const [x1, x2] = wallProps[windex].colRange;
                const [y1, y2] = wallProps[windex].rowRange;                
                const tx = Math.floor((twidth * wx / tileFactor) % (twidth - 1));
                this.context.drawImage(this.textures, tx+textureIndex*twidth, 0, 1, theight, x1, y1, x2-x1, y2-y1);                
            }                   
            this.context.fillStyle = `rgba(0,0,0,${1-start.material.luminosity}`;
            this.context.beginPath();
            this.context.moveTo(start.colRange[1], start.rowRange[0]);
            this.context.lineTo(start.colRange[1], start.rowRange[1]);
            this.context.lineTo(end.colRange[0], end.rowRange[1]);
            this.context.lineTo(end.colRange[0], end.rowRange[0]);
            this.context.closePath();
            this.context.fill();
        }
        
        // // draw selection borders if edge was selected
        // if (isSelectedEdge(hit.edge, this.world.selection)) {
        //      drawRect(this.context, [[col1, startRow-2], [col2, startRow]], 'rgb(250,100,0)');
        //      drawRect(this.context, [[col1, endRow], [col2, endRow+2]], 'rgb(250,100,0)');
        // }        
    };

    //private drawSingleColorWall = 
}

const determineColor = (material: IMaterial): string => {    
    if (material?.color) {        
        const color = material.color;
        return `rgba(${color[0] * material.luminosity},${color[1] * material.luminosity},${color[2] * material.luminosity},${color[3]})`;
    }
    return `rgb(0,0,${material.luminosity*155 + 100})`;
};

export const determineLight = (hit: RayHit) => {
    let color = 0.4;
    if (hit?.edge) {
        let m = Math.abs(slope([hit.edge.start.vector, hit.edge.end.vector]));            
        if (!isFinite(m)) return 1;        
        color += (m / (1 + m)) * (1 - color);
    }
    return color;
};
