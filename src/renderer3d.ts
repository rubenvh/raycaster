import { makeRays } from './camera';
import { slope } from './math/lineSegment';
import * as raycaster from './raycaster';
import { World } from './world';
import { drawRect, drawTrapezoid } from './drawing/drawing';
import { Guid } from 'guid-typescript';
import { RayHit } from './geometry/collision';
import { distance, Vector } from './math/vector';
import { Color, IMaterial } from './geometry/properties';
import { isEdge, isSelectedEdge } from './geometry/selectable';

type WallProps = {
    edgeId: Guid,
    height: number, 
    material: IMaterial,
    intersection: Vector,
    origin: Vector,
    length: number,
    rowRange: [number, number], 
    colRange: [number,number],
    distance: number,
};
type ZBuffer = Map<Guid,WallProps[]>[];
export class Renderer3d {
    private context: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private textures: HTMLCanvasElement;
    private textureContext: CanvasRenderingContext2D;
    private convergenceShade = 0;
    private resolution = 640;
    private horizonDistance = 500;

    constructor(private world: World, private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.context.font = '12px sans-serif';
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
    }
        
    private createWall = (hit: RayHit, rayIndex: number): WallProps => {
        const height = this.convertDistanceToWallHeight(hit.distance || this.horizonDistance);                    
        const startRow = Math.floor((this.height - height)/2);
        const endRow = Math.floor((this.height + height)/2);
        const edgeId = hit.edge && hit.edge.id || Guid.parse(Guid.EMPTY);

        return ({edgeId, height, 
            material: hit.edge && {...hit.edge.material, luminosity: determineLight(hit)},
            rowRange: [startRow, endRow],
            colRange: [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex+1)],
            intersection: hit.intersection,
            origin: hit.edge?.start.vector,
            distance: hit.distance,
            length: hit.edge && distance(hit.edge.start.vector, hit.edge.end.vector),
            
        });
    };

    public render = () => {                   
        // draw floor + sky
        this.drawSky();        
        this.drawFloor();

        // initiate raycasting
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
            let previousEdge: Guid = null;
            let currentWallGroup = Guid.create();
            const groupedByEdge = rays.reduce(
                (acc, r, rayIndex) => {
                    if (i > indexes[rayIndex]-1) { return acc; }
                    const wall = this.createWall(r.hits[i], rayIndex); 
                    if (wall.edgeId !== (previousEdge || wall.edgeId)) { currentWallGroup = Guid.create(); };
                    previousEdge = wall.edgeId;
                    return acc.set(currentWallGroup, [...acc.get(currentWallGroup)||[], wall]);                    
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
                this.drawWall(wallProps);                           
            } );
        }  
    };

    private convertDistanceToWallHeight = (d: number) => 10 * this.height / d;
    private mapToColumn = (column: number) => Math.floor(this.width - column * this.width / this.resolution);

    private drawSky = () => this.drawBackground('rgb(200,200,200)', 0, this.canvas.height/2);
    private drawFloor = () => this.drawBackground('rgb(50,80,80)', this.canvas.height/2, this.canvas.height);
    private drawBackground = (color: string, startRow: number, endRow: number) => {        
        let c: string|CanvasGradient = color;
        if (this.convergenceShade != null) {
            var gradient = this.context.createLinearGradient(0, startRow, 0, endRow);        
            const convergence = `rgb(${this.convergenceShade},${this.convergenceShade},${this.convergenceShade})`;
            gradient.addColorStop(0, startRow === 0 ? color : convergence);
            gradient.addColorStop(1, startRow === 0? convergence : color);
            c = gradient
        }        
        drawRect(this.context, [[0, startRow], [this.canvas.width, endRow]], c);
    }

    private drawWall = (wallProps: WallProps[]) => {        
        const start = wallProps[wallProps.length-1];
        const end = wallProps[0];  
        // don't draw invisible walls      
        if (start.height <= 0) return;
        if (start.material.color[3] === 0) return;

        if (!start.material?.texture) {
            // no texture: just draw color trapezoid
            drawTrapezoid(this.context, getTrapezoid(start, end), getColor(start.material));
        } else {            
            this.drawTexture(wallProps);
        }  
        
        // apply fading    
        if (this.convergenceShade != null) {             
            this.applyFading(wallProps);
        }   
        
        this.drawStats(wallProps);        
    };

    private drawTexture = (wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length-1];
        const end = wallProps[0];
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
        // apply luminosity to texture
        drawTrapezoid(this.context, getTrapezoid(start, end), `rgba(0,0,0,${1-start.material.luminosity}`);
    }   
    
    private applyFading = (wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length-1];
        const end = wallProps[0];
        const trapezoid = getTrapezoid(start, end);
        var gradient = this.context.createLinearGradient(trapezoid[0][0], 0, trapezoid[3][0], 0);
        wallProps.reverse().filter((w, i) => i % 20 === 0)             
        .forEach((w, i, a) => {
           const fadeFactor = Math.min(this.horizonDistance, w.distance)/this.horizonDistance;
           const fadeColor = `rgba(${this.convergenceShade},${this.convergenceShade},${this.convergenceShade},${fadeFactor})`;
           gradient.addColorStop(i/a.length, fadeColor);
        })
        
        drawTrapezoid(this.context, getTrapezoid(start, end), gradient);
    }

    private drawStats = (wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length-1];
        const end = wallProps[0];
        if (isSelectedEdge(start.edgeId, this.world.selection)) {
                       
            const texts = [
                `edgeId: ${JSON.stringify(start.edgeId)}`,
                `distance: ${start.distance.toFixed(2)}`,
                `lumen: ${start.material.luminosity.toFixed(2)}`,
                `length: ${start.length.toFixed(2)}`
            ];
            const widest = texts.map(_ => this.context.measureText(_)).reduce((acc, m) => Math.max(acc, m.width), 0);
                        
            const center = [start.colRange[0] + (end.colRange[1]-start.colRange[0])/2 - widest/2,
                            start.rowRange[0] + (start.rowRange[1]-start.rowRange[0])/2];

            this.context.fillStyle = 'rgb(0,0,0)';                        
            texts.forEach((t, i) => this.context.fillText(t, center[0], (i-(texts.length/2))*10+center[1]));
            
        }
    }    
}

const getTrapezoid = (start: WallProps, end: WallProps): [Vector, Vector, Vector, Vector] => ([
    [start.colRange[1], start.rowRange[0]],
    [start.colRange[1], start.rowRange[1]],
    [end.colRange[0], end.rowRange[1]],
    [end.colRange[0], end.rowRange[0]]]);



const getColor = (material: IMaterial): string => {    
    if (material?.color) {        
        const color = material.color;
        return `rgba(${color[0] * material.luminosity},${color[1] * material.luminosity},${color[2] * material.luminosity},${color[3]})`;
    }
    return `rgb(0,0,${material.luminosity*155 + 100})`;
};

export const determineLight = (hit: RayHit) => {        
    let percentage = 0.4;
    if (hit?.edge) {
        let m = Math.abs(slope([hit.edge.start.vector, hit.edge.end.vector]));            
        if (!isFinite(m)) return 1;        
        percentage += (m / (1 + m)) * (1 - percentage);
    }
    return percentage;
};
