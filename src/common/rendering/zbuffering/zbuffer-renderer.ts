import { EMPTY_GEOMETRY } from '../../geometry/geometry';
import { makeRays, DEFAULT_CAMERA, ICamera, clip } from '../../camera';
import { intersectRayPlane, intersectRaySegment, IRay, makeRay } from '../../geometry/collision';
import { subtract, Vector } from '../../math/vector';
import { useAppDispatch } from '../../store';
import { connect } from '../../store/store-connector';
import { IRenderer } from '../renderer';
import { IEdge, NULL_EDGE } from '../../geometry/edge';
import { walk } from '../../geometry/bsp/querying';
import { distance } from '../../geometry/vertex';
import { segmentLength } from '../../math/lineSegment';
import { castRaysOnEdge } from '../raycasting/raycaster';
import { WallPainter } from '../../drawing/wall-painter';
import { Heap } from '../../datastructures/heap';
import { drawRect, drawSegment } from '../../drawing/drawing';
import { createPlane } from '../../math/plane';
import { getMaterial, isTranslucent } from '../../geometry/properties';
import { IWorldConfigState } from '../../store/world-config';

export class ZBufferRenderer implements IRenderer {

    private context: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private resolution = 640;
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private wallPainter: WallPainter;
    private worldConfig: IWorldConfigState;

    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.context.imageSmoothingEnabled = false;

        this.canvas.width = this.resolution;
        this.canvas.height = Math.round(this.resolution * 3 / 4);
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.wallPainter = new WallPainter(this.context, this.resolution, this.height, this.width);
        connect(s => {
            this.camera = s.player.camera;            
            if (this.wallGeometry != s.walls.geometry) {
                this.wallGeometry = s.walls.geometry;
            }
            this.worldConfig = s.worldConfig;
        });
    }


    public isActive(): boolean {
        return !!this.wallGeometry.bsp
    }

    render(fps: number): void {

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawSky()
        this.drawFloor();

        let buffer = new ZBuffer(this.resolution, this.camera, this.wallPainter, this.context);

        // TODO: pass direction into walk function so we can use it to ignore entire branch in some cases
        walk(this.wallGeometry.bsp, this.camera.position, (ps => {
            for (let p of ps) {
                for (let e of p.edges) {
                    if (e.material === null) continue;
                    const clipped = clip(e, this.camera);
                    if (clipped === NULL_EDGE) continue;

                    buffer.add(clipped, e.start.vector);
                }
            }
            return !buffer.isFull();
        }))


        buffer.render();
    }      

    private drawSky = () => this.drawBackground('rgb(200,200,200)', 0, this.canvas.height / 2);
    private drawFloor = () => this.drawBackground('rgb(50,80,80)', this.canvas.height / 2, this.canvas.height);
    private drawBackground = (color: string, startRow: number, endRow: number) => {
        let c: string | CanvasGradient = color;
        const shade = this.worldConfig.fadeOn;
        if (shade != null) {
            var gradient = this.context.createLinearGradient(0, startRow, 0, endRow);
            const convergence = `rgb(${shade},${shade},${shade})`;
            gradient.addColorStop(0, startRow === 0 ? color : convergence);
            gradient.addColorStop(1, startRow === 0 ? convergence : color);
            c = gradient
        }
        drawRect(this.context, [[0, startRow], [this.canvas.width, endRow]], c);
    }
}

export class ZBuffer {
    private cols: ZBufferColumn[];    
    private rays: IRay[];
    private debug = true;
    constructor(private resolution: number, private camera: ICamera, private wallPainter: WallPainter, private context: CanvasRenderingContext2D) {
        this.cols = Array.from({ length: resolution }, () => new ZBufferColumn());
        this.rays = makeRays(this.resolution, this.camera);
        
    }

    public render(): void {
        for (let i=0; i < this.cols.length; i++) {
            this.cols[i].render();
        }        
    }

    public add(edge: IEdge, unclippedStart: Vector): void {        
        
        let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));        
        let eray = makeRay(this.camera.position, subtract(edge.end.vector, this.camera.position));
        
        let sproj = intersectRayPlane(sray, createPlane(this.camera.screen))?.point;
        //let sproj = intersectRaySegment(sray, this.camera.screen)?.point;
        let eproj = intersectRayPlane(eray, createPlane(this.camera.screen))?.point;
        //let eproj = intersectRaySegment(eray, this.camera.screen)?.point;
        if (!sproj || !eproj) { 
            drawSegment(this.context, sray.line, 'rgb(255,0,0)', 1);
            drawSegment(this.context, eray.line, 'rgb(0,255,0)', 1);
            drawSegment(this.context, this.camera.screen, 'rgb(255,255,0)', 1);  
            return; 
        }
                
        let [pl,] = this.camera.screen;
        let screenLength = segmentLength(this.camera.screen);
        let scol = Math.round(distance(pl, sproj)/screenLength * this.resolution);
        let ecol = Math.round(distance(pl, eproj)/screenLength * this.resolution);
        
        [scol, ecol] = [Math.min(scol,ecol), Math.max(scol, ecol)];        
        let rays = this.rays.slice(scol, ecol);    
        let hits = castRaysOnEdge(rays, edge);
        for (let i = 0; i < hits.length; i++) {
            if (hits[i].intersection === null) continue;
            if ((getMaterial(hits[i].intersection.face, edge.material)?.color[3]||0)===0) continue;
            const wall = this.wallPainter.createWall(hits[i], scol+i, unclippedStart );            
            if (wall.height <= 0) continue;
            this.cols[scol+i].add({
                isOpaque: (wall.material?.color[3]||0) === 1, 
                distance: hits[i].distance,
                render: () => this.wallPainter.drawWall([wall])
            });            
        }        
    }

    public isFull(): boolean {   
        return this.cols.every(c => c.isFull());     
    }
}
export class ZBufferColumn {
    private heap: Heap<ZBufferElement>;
    constructor() {        
        this.heap = new Heap<ZBufferElement>([], (a, b) => a.distance - b.distance);
    }

    public isFull(): boolean {
        return this.heap.heapSize > 0 && this.heap.max().isOpaque;
    }

    public add(el: ZBufferElement): ZBufferColumn {
        this.heap.insert(el);
        return this;
    }

    public render(): void {
        let sorted = this.heap.sort();        
        // for (let i = 0; i < sorted.length; i++) {
        //     sorted[i].render();
        // }
        for (let i = sorted.length-1; i >= 0; i--) {
            sorted[i].render();
        }        
    }
}
export type ZBufferElement = {
    isOpaque: boolean;
    distance: number;
    render: () => void;
}

