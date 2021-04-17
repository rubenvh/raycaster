import { EMPTY_GEOMETRY, IGeometry } from './geometry/geometry';
import { cloneKey, createEntityKey, IEntityKey } from './geometry/entity';
import { TextureLibrary } from './textures/textureLibrary';
import { Texture } from "./textures/texture";
import { ICamera, makeRays, makeCamera, DEFAULT_CAMERA } from './camera';
import * as raycaster from './raycaster';
import { World } from './stateModel';
import { drawRect, drawTrapezoid } from './drawing/drawing';
import { Guid } from 'guid-typescript';
import { lookupMaterialFor, RayHit } from './geometry/collision';
import { Vector } from './math/vector';
import { IMaterial } from './geometry/properties';
import { isSelectedEdge, SelectableElement } from './geometry/selectable';
import { statisticsUpdated } from './store/stats';
import { useAppDispatch } from './store';
import { connect } from './store/store-connector';

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
    private selectedElements: SelectableElement[] = [];
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    
    constructor(private world: World, private canvas: HTMLCanvasElement, private textureLibrary: TextureLibrary) {
        this.context = canvas.getContext('2d');
        this.context.imageSmoothingEnabled = false;        
        this.context.font = '12px sans-serif';

        this.canvas.width = this.resolution;
        this.canvas.height = Math.round(this.resolution * 3 / 4);
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        connect(s => {
            this.selectedElements = s.selection.elements;
            this.camera = s.player.camera;
            this.wallGeometry = s.walls.geometry;
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
        const rays = raycaster.castRays(makeRays(this.resolution, this.camera), this.wallGeometry, raycaster.passTroughTranslucentEdges);
        // construct a z-index buffer: 
        const startZBuffering = performance.now();
        const zbuffer = this.constructZBuffer(rays);        

        // draw floor + sky
        const startDrawing = performance.now();
        this.drawSky();        
        this.drawFloor();        
        // draw the z-buffer => farthest to closest 
        this.drawZBuffer(zbuffer);

        const endDrawing = performance.now();

        if (!this.lastUpdated || endDrawing-this.lastUpdated > 2000){
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
                intersections: {rayIntersectionStats: rays?.map(x => x.stats)}}));
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
        const shade = this.world.config?.fadeOn;
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

        const texture = this.textureLibrary.getTexture(start.material);
        if (!texture) {
            drawTrapezoid(this.context, getTrapezoid(start, end), getColor(start.material, this.getLumen(start)));
        } else {            
            this.drawTexture(texture, wallProps);            
        }  
        
        // apply fading    
        if (this.world.config?.fadeOn != null) {
            this.applyFading(wallProps);
        }   
        
        this.drawStats(wallProps);        
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
        const shade = this.world.config?.fadeOn;
        var gradient = this.context.createLinearGradient(trapezoid[0][0], 0, trapezoid[3][0], 0);        
        const addGradient = (step: number, w: WallProps) => {            
            const fadeFactor = Math.min(this.horizonDistance, w.distance)/(this.horizonDistance+10);
            const fadeColor = `rgba(${shade},${shade},${shade},${fadeFactor.toFixed(2)})`;
            gradient.addColorStop(step, fadeColor);            
        }
        addGradient(0, start);
        addGradient(1, end);
        drawTrapezoid(this.context, trapezoid, gradient);
    }

    // TODO remove this: send info to statsComponent via store instead        
    private drawStats = (wallProps: WallProps[]) => {        
        const start = wallProps[wallProps.length-1];
        const end = wallProps[0];
        if (isSelectedEdge(start.edgeId, this.selectedElements)) {
                       
            const texts = [
                `edgeId: ${JSON.stringify(start.edgeId)}`,
                `distance: ${start.distance.toFixed(2)}`,                
                `lumen: ${this.getLumen(start).toFixed(2)}`,
                `translucency: ${start.material.color[3].toFixed(2)}`,
                `length: ${start.length.toFixed(2)}`
            ];
            const widest = texts.map(_ => this.context.measureText(_)).reduce((acc, m) => Math.max(acc, m.width), 0);
                        
            const center = [start.colRange[0] + (end.colRange[1]-start.colRange[0])/2 - widest/2,
                            start.rowRange[0] + (start.rowRange[1]-start.rowRange[0])/2];

            this.context.fillStyle = 'rgb(0,0,0)';                        
            texts.forEach((t, i) => this.context.fillText(t, center[0], (i-(texts.length/2))*10+center[1]));            
        }
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
