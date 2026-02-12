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
import { ILineSegment, segmentLength } from '../../math/lineSegment';
import { castRaysOnEdgeRange } from '../raycasting/raycaster';
import { WallPainter, WallProps } from '../../drawing/wall-painter';
import { Heap } from '../../datastructures/heap';
import { drawRect } from '../../drawing/drawing';
import { createPlane } from '../../math/plane';
import { getMaterial, isTranslucent } from '../../geometry/properties';
import { IWorldConfigState } from '../../store/world-config';
import { statisticsUpdated } from '../../store/stats';
import { PriorityDeque } from 'priority-deque';

const dispatch = useAppDispatch();

export class ZBufferRenderer implements IRenderer {

    private context: CanvasRenderingContext2D;    
    private width: number;
    private height: number;
    private resolution = 640;
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private wallPainter: WallPainter;
    private worldConfig: IWorldConfigState;
    private lastUpdated;
    private buffer: ZBuffer;  // Persistent buffer
    
    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');        
        this.context.imageSmoothingEnabled = false;

        this.canvas.width = this.resolution;
        this.canvas.height = Math.round(this.resolution * 3 / 4);
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.wallPainter = new WallPainter(this.context, this.resolution, this.height, this.width);
        // Initialize buffer after wallPainter is created
        this.buffer = new ZBuffer(this.resolution, this.camera, this.wallPainter, this.context);
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
        // construct a z-index buffer: 
        const startZBuffering = performance.now();
        this.buffer.clear();
        this.buffer.updateCamera(this.camera);
        
        let edgesTested: number = 0;
        let count = 0;
        let depth = 40;
        let clippedSegments: {segment: ILineSegment, depth: number}[] = [];
        // TODO: can't we pass direction of camera to discard entire branches of the tree?
        walk(this.wallGeometry.bsp, this.camera.position, (ps => {
            let increment = 0;
            for (let p of ps) {
                for (let e of p.edges) {
                    if (e.material == null) continue;
                    const clipped = clip(e, this.camera);
                    if (clipped === NULL_EDGE) continue;

                    clippedSegments.push({ segment: clipped.segment, depth: count });
                    increment = increment || 1;

                    edgesTested++;
                    this.buffer.add(clipped, e.start.vector);
                    // Note: removed early termination based on buffer.isFull() because BSP walk 
                    // doesn't guarantee front-to-back distance ordering (coplanar edges can be 
                    // at any distance). Must process all edges and let the ZBuffer sort by distance.
                }
            }    
            count = count + increment;
            return !this.buffer.isFull();
        }))

        // draw floor + sky
        const startDrawing = performance.now();
        // this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawSky();
        this.drawFloor();        
        this.buffer.render();
        const endDrawing = performance.now();
        
        if (!this.lastUpdated || endDrawing - this.lastUpdated > 1000) {
            this.lastUpdated = endDrawing;
            dispatch(statisticsUpdated({
                performance: {
                    timing: {
                        drawing: endDrawing - startDrawing,
                        casting: 0,
                        zbuffering: startDrawing - startZBuffering,
                        total: endDrawing - startZBuffering
                    },
                    fps
                },
                intersections: { stats: { 
                    polygons: new Set<String>(), 
                    edgeTests: [edgesTested, edgesTested], 
                    polygonTests: [0, 0], 
                    edgeCount: 0, 
                    polygonCount: 0, 
                    edgePercentage: 0 } },
                detectedEdges: clippedSegments
            }));
        }

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
    // Cached values that only change when camera changes
    private screenLength: number;
    private screenPlane: ReturnType<typeof createPlane>;
    private screenLeft: Vector;
    
    constructor(private resolution: number, private camera: ICamera, private wallPainter: WallPainter, private context: CanvasRenderingContext2D) {
        this.cols = Array.from({ length: resolution }, () => new ZBufferColumn());
        this.rays = makeRays(this.resolution, this.camera);
        this.updateCachedValues();
    }
    
    private updateCachedValues(): void {
        this.screenLength = segmentLength(this.camera.screen);
        this.screenPlane = createPlane(this.camera.screen);
        this.screenLeft = this.camera.screen[0];
    }

    public render(): void {

        let stop = false;
        while (!stop) {
            stop = true;
            let current_group: WallProps[] = [];
            for (let i=0; i < this.cols.length; i++) {                
                let cur = this.cols[i].shift();
                if (cur) {
                    stop = false;
                    if (current_group.length === 0 || current_group[0].edgeId === cur.edgeId) {
                        current_group.push(cur);
                    } else {
                        this.wallPainter.drawWall(current_group);
                        current_group = [];
                        current_group.push(cur);
                    }
                } else {
                    if (current_group.length > 0) { this.wallPainter.drawWall(current_group); }
                    current_group = [];
                }               
            }              
            if (current_group.length > 0) { this.wallPainter.drawWall(current_group); }
        }
    }

    public add(edge: IEdge, unclippedStart: Vector): void {        
        
        let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));        
        let eray = makeRay(this.camera.position, subtract(edge.end.vector, this.camera.position));        
        let sproj = intersectRayPlane(sray, this.screenPlane)?.point;        
        let eproj = intersectRayPlane(eray, this.screenPlane)?.point;        
        if (!sproj || !eproj) { return; }
                
        let scol = Math.ceil(distance(this.screenLeft, sproj)/this.screenLength * this.resolution);
        let ecol = Math.floor(distance(this.screenLeft, eproj)/this.screenLength * this.resolution);
        
        [scol, ecol] = [Math.max(0, Math.min(scol,ecol)-1), Math.min(this.resolution, Math.max(scol, ecol)+1)];
        let hits = castRaysOnEdgeRange(this.rays, scol, ecol, edge);
        for (let i = 0; i < hits.length; i++) {
            if (hits[i].intersection === null) continue;
            if ((getMaterial(hits[i].intersection.face, edge.material)?.color[3]||0)===0) continue;
            const wall = this.wallPainter.createWall(hits[i], scol+i, unclippedStart );            
            if (wall.height <= 0) {continue;}
            let col = this.cols[scol+i];            
            col.add(wall);            
        }    
    }

    public isFull(): boolean {
        let allFilled = true;
        for (let c of this.cols) {             
            allFilled = allFilled && c.isFull();
        }
        return allFilled;
    }    

     public clear(): void {
        for (let i = 0; i < this.cols.length; i++) {
            this.cols[i].clear();
        }
    }
    public updateCamera(camera: ICamera): void {
        this.camera = camera;
        this.rays = makeRays(this.resolution, this.camera);
        this.updateCachedValues();
    }
}
export class ZBufferColumn {
    // private heap: Heap<WallProps>;
    private queue: PriorityDeque<WallProps>;
    private hasOpaqueWall: boolean = false;  // Track if any wall has alpha === 1
    
    constructor() {        
        // this.heap = new Heap<WallProps>([], (a, b) => a.distance - b.distance);                     
        this.queue = new PriorityDeque<WallProps>({ compare: (a, b) => a.distance - b.distance });
    }

    public clear(): void {
        this.queue.clear();
        this.hasOpaqueWall = false;
    }

    public isFull(): boolean {     
        return this.hasOpaqueWall;
    }
    
    public add(el: WallProps): ZBufferColumn {        
        // this.heap.insert(el);
        this.queue.push(el);
        // Track if we have any opaque wall (alpha === 1)
        if (!this.hasOpaqueWall && (el.material?.color[3] || 0) === 1) {
            this.hasOpaqueWall = true;
        }
        return this;
    }

    public shift(): WallProps {
        return this.queue.shift();
    }

    public render(painter: WallPainter): void {
        while (this.queue.length > 0) {
            painter.drawWall([this.queue.shift()]);
        }
        // let sorted = this.heap.sort();     
        // for (let i = sorted.length-1; i >= 0; i--) {
        //     painter.drawWall([sorted[i]]);
        // }           
    }
}