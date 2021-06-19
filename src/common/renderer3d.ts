import { EMPTY_GEOMETRY } from './geometry/geometry';
import { cloneKey, createEntityKey, IEntityKey } from './geometry/entity';
import { makeRays, DEFAULT_CAMERA } from './camera';
import * as raycaster from './raycaster';
import { drawRect, drawTrapezoid } from './drawing/drawing';
import { Guid } from 'guid-typescript';
import { lookupMaterialFor, RayHit } from './geometry/collision';
import { Vector } from './math/vector';
import { IMaterial } from './geometry/properties';
import { statisticsUpdated } from './store/stats';
import { useAppDispatch } from './store';
import { connect } from './store/store-connector';
import { IWorldConfigState } from './store/world-config';
import { textureLib, TextureLibrary } from './textures/textureLibrary';
import { Texture } from './textures/texture';

const dispatch = useAppDispatch();

export type WallProps = {
    edgeId: IEntityKey,
    height: number, 
    edgeLuminosity: number,
    material: IMaterial,
    intersection: Vector,
    origin: Vector,
    length: number,
    rowRange: [number, number], 
    colRange: [number,number],
    distance: number,
};
type ZBuffer = Map<IEntityKey,WallProps[]>[];
export class Renderer3d {
    private context: CanvasRenderingContext2D;    
    private width: number;
    private height: number;        
    private resolution = 1280;
    private horizonDistance = 300;
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private worldConfig: IWorldConfigState = {};
    private textureLibrary: TextureLibrary = textureLib;

    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.context.imageSmoothingEnabled = false;        
        
        this.canvas.width = this.resolution;
        this.canvas.height = Math.round(this.resolution * 3 / 4);
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        connect(s => {
            this.camera = s.player.camera;
            this.wallGeometry = s.walls.geometry;
            this.worldConfig = s.worldConfig;            
        });
        
    }

        
    private createWall = (hit: RayHit, rayIndex: number): WallProps => {
        const height = this.convertDistanceToWallHeight(hit.distance || this.horizonDistance);                    
        const startRow = Math.floor((this.height - height)/2);
        const endRow = Math.floor((this.height + height)/2);
        const edgeId = hit.edge && hit.edge.id || Guid.EMPTY;

        return ({edgeId: cloneKey(edgeId), height, 
            edgeLuminosity: hit.edge?.luminosity || 0,            
            material: lookupMaterialFor(hit),
            rowRange: [startRow, endRow],
            colRange: [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex+1)],
            intersection: hit.intersection?.point,
            origin: hit.edge?.start.vector,
            distance: hit.distance,
            length: hit.edge?.length,            
        });
    };

    private lastUpdated;
    public render = (fps: number) => {                           
        // initiate raycasting
        const startCasting = performance.now();
        const rays = raycaster.castCollisionRays(makeRays(this.resolution, this.camera), this.wallGeometry);
        // construct a z-index buffer: 
        const startZBuffering = performance.now();
        const zbuffer = this.constructZBuffer(rays.castedRays);        

        // draw floor + sky
        const startDrawing = performance.now();
        this.drawSky();        
        this.drawFloor();        
        // draw the z-buffer => farthest to closest 
        this.drawZBuffer(zbuffer);

        // // dray column per column (no zbuffer needed): less efficient when handling lots of texture less walls
        // let rayIndex = 0;
        // for (const ray of rays.castedRays) {
        //     for (let i = ray.hits.length-1; i >= 0; i--) {
        //         this.drawWall([this.createWall(ray.hits[i], rayIndex)]);
        //     }
        //     rayIndex++;
        // }
        
        const endDrawing = performance.now();

        if (!this.lastUpdated || endDrawing-this.lastUpdated > 1000){
            this.lastUpdated= endDrawing;
            dispatch(statisticsUpdated({
                performance: { 
                    timing: {
                        drawing: endDrawing-startDrawing, 
                        casting: startZBuffering - startCasting, 
                        zbuffering: startDrawing - startZBuffering, 
                        total: endDrawing - startCasting
                    }, 
                    fps}, 
                intersections: {stats: rays.stats}}));
        }        
    };

    /**
     * This function loops the rays iteratively and constructs wall properties for all the closest ray
     * hits and groups them by edge. It then continues with the 2nd closest and so on until we reach 
     * the farthest ray hits. Grouping by edge allows us to draw a wall in 1 go completely instead 
     * of per column. 
     */
    private constructZBuffer = (rays: raycaster.CastedRay[]): ZBuffer => {
        const zbuffer: ZBuffer = [];        
        const indexes = rays.map(r => r.hits.length);
        const max = Math.max(...indexes);
        for (let i = 0; i < max; i++) {
            let previousEdge: IEntityKey = null;
            let currentWallGroup = createEntityKey();
            const groupedByEdge = rays.reduce(
                (acc, r, rayIndex) => {
                    if (i > indexes[rayIndex]-1) { return acc; }
                    const wall = this.createWall(r.hits[i], rayIndex); 
                    if (wall.edgeId !== (previousEdge || wall.edgeId)) { currentWallGroup = createEntityKey(); };
                    previousEdge = wall.edgeId;
                    return acc.set(currentWallGroup, [...acc.get(currentWallGroup)||[], wall]);                    
                }, new Map<IEntityKey, WallProps[]>());

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

    private convertDistanceToWallHeight = (d: number) => Math.round(10 * this.height / d);
    private mapToColumn = (column: number) => Math.floor(this.width - column * this.width / this.resolution);

    private drawSky = () => this.drawBackground('rgb(200,200,200)', 0, this.canvas.height/2);
    private drawFloor = () => this.drawBackground('rgb(50,80,80)', this.canvas.height/2, this.canvas.height);
    private drawBackground = (color: string, startRow: number, endRow: number) => {        
        let c: string|CanvasGradient = color;
        const shade = this.worldConfig.fadeOn;
        if (shade != null) {
            var gradient = this.context.createLinearGradient(0, startRow, 0, endRow);        
            const convergence = `rgb(${shade},${shade},${shade})`;
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

        const texture = this.textureLibrary.lookupTexture(start.material);
        if (!texture) {
            drawTrapezoid(this.context, getTrapezoid(start, end), getColor(start.material, this.getLumen(start)));
        } else {            
            this.drawTexture(texture, wallProps);            
        }  
        
        // apply fading    
        if (this.worldConfig.fadeOn != null) {
            this.applyFading(wallProps);
        }                 
    };

    private drawTexture = (texture: Texture, wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length-1];
        const end = wallProps[0];

        // draw texture
        texture.drawTexture(this.context, wallProps);        
        // apply luminosity to texture
        drawTrapezoid(this.context, getTrapezoid(start, end), `rgba(0,0,0,${1-this.getLumen(start)}`);
    }   
    
    private applyFading = (wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length-1];        
        const end = wallProps[0];
        const trapezoid = getTrapezoid(start, end);
        const shade = this.worldConfig.fadeOn;
        let color: string | CanvasGradient;

        if (start.material.luminosity != null) {
            // luminosity is overidden on the wall's material definition:            
            color = `rgba(${shade},${shade},${shade},${( 1 - start.material.luminosity).toFixed(2)})`;
        } else {
            // automatically decide fading amount based on the wall's distance to the camera
            const addGradient = (step: number, w: WallProps, gradient: CanvasGradient): CanvasGradient => {            
                const fadeFactor = Math.min(this.horizonDistance, w.distance)/(this.horizonDistance+10);
                const fadeColor = `rgba(${shade},${shade},${shade},${fadeFactor.toFixed(2)})`;
                gradient.addColorStop(step, fadeColor);            
                return gradient;
            }
            color = addGradient(1, end, 
                addGradient(0, start, 
                    this.context.createLinearGradient(trapezoid[0][0], 0, trapezoid[3][0], 0)))
        }
        drawTrapezoid(this.context, trapezoid, color);        
    }

    private getLumen = (wall: WallProps) => wall.material.luminosity || wall.edgeLuminosity;
}

const getTrapezoid = (start: WallProps, end: WallProps): [Vector, Vector, Vector, Vector] => ([    
    [start.colRange[1], start.rowRange[0]-0.5],
    [start.colRange[1], start.rowRange[1]+0.5],
    [end.colRange[0], end.rowRange[1]+0.5],
    [end.colRange[0], end.rowRange[0]-0.5]]);

const getColor = (material: IMaterial, lumen: number): string => {        
    if (material?.color) {        
        const color = material.color;
        return `rgba(${color[0] * lumen},${color[1] * lumen},${color[2] * lumen},${color[3]})`;
    }
    return `rgb(0,0,${lumen*155 + 100})`;
};
