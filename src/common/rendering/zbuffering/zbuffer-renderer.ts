import { EMPTY_GEOMETRY } from '../../geometry/geometry';
import { makeRays, DEFAULT_CAMERA, ICamera, clip } from '../../camera';
import { intersectRayPlane, intersectRaySegment, IRay, makeRay } from '../../geometry/collision';
import { subtract, Vector } from '../../math/vector';
import { useAppDispatch } from '../../store';
import { connect } from '../../store/store-connector';
import { IRenderer } from '../renderer';
import { IEdge, NULL_EDGE } from '../../geometry/edge';
import { walkWithFrustum } from '../../geometry/bsp/querying';
import { distance } from '../../geometry/vertex';
import { ILineSegment, segmentLength } from '../../math/lineSegment';
import { castRaysOnEdgeRange } from '../raycasting/raycaster';
import { WallPainter, WallProps } from '../../drawing/wall-painter';
import { Heap } from '../../datastructures/heap';
import { drawRect } from '../../drawing/drawing';
import { createPlane } from '../../math/plane';
import { getMaterial, isTranslucent } from '../../geometry/properties';
import { DEFAULT_FLOOR_COLOR, DEFAULT_SKY_COLOR, IWorldConfigState } from '../../store/world-config';
import { createSkyGradient } from '../common/sky-gradient';
import { statisticsUpdated } from '../../store/stats';
import { IMutableEdgeDiff, IBspContext } from '../../store/bsp-state';
import { isStaleInBsp, collectDirtyEdges } from './zbuffer-core';
import { SkyboxRenderer } from '../../skybox/skybox-renderer';
import { IPolygon } from '../../geometry/polygon';
import { buildPolygonGrid, IPolygonGrid } from '../../geometry/polygon-grid';
import { renderFloors, buildColumnBounds, IFloorRendererConfig } from './floor-renderer';
import { renderWalls } from './wall-renderer';
import { textureLib } from '../../textures/textureLibrary';
import { getResolution } from '../../config/resolution';
// T3.8: Removed PriorityDeque import — replaced with sorted array for small collections

const dispatch = useAppDispatch();

export class ZBufferRenderer implements IRenderer {

    private context: CanvasRenderingContext2D;    
    private width: number;
    private height: number;
    private resolution = getResolution();
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private bspContext: IBspContext | null = null;
    private wallPainter: WallPainter;
    private worldConfig: IWorldConfigState;
    private lastUpdated;
    private buffer: ZBuffer;  // Persistent buffer
    private skyboxRenderer = new SkyboxRenderer();
    /** Polygons visited during the last BSP walk, for floor/ceiling rendering prefilter */
    private visiblePolygons: IPolygon[] = [];
    
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
            this.bspContext = { tree: s.bsp.treeHolder?.node ?? null, dirtyEdges: s.bsp.dirtyEdges };
            this.worldConfig = s.worldConfig;
            this.skyboxRenderer.update(this.worldConfig);
        });
    }


    public isActive(): boolean {
        return !!this.bspContext?.tree
    }

    render(fps: number): void {
        // construct a z-index buffer: 
        const startZBuffering = performance.now();
        this.buffer.clear();
        this.buffer.updateCamera(this.camera);
        
        let edgesTested: number = 0;
        let staleEdgesSkipped: number = 0;
        let dirtyEdgesTested: number = 0;
        let count = 0;
        let depth = 40;
        const dirtyEdges = this.bspContext?.dirtyEdges;
        const shouldCollectStats = !this.lastUpdated || performance.now() - this.lastUpdated > 1000;
        let clippedSegments: {segment: ILineSegment, depth: number}[] = shouldCollectStats ? [] : null;
        this.visiblePolygons = [];
        walkWithFrustum(this.bspContext?.tree, this.camera.position, this.camera.planes, (ps => {
            let increment = 0;
            for (let p of ps) {
                // Collect polygon for floor/ceiling rendering prefilter
                if (p.floorMaterial != null || p.ceilingMaterial != null) {
                    this.visiblePolygons.push(p);
                }
                for (let e of p.edges) {
                    if (e.material == null) continue;
                    
                    // Skip stale edges (removed/modified since last BSP build)
                    if (dirtyEdges && isStaleInBsp(e.id, dirtyEdges)) {
                        staleEdgesSkipped++;
                        continue;
                    }
                    
                    const clipped = clip(e, this.camera);
                    if (clipped === NULL_EDGE) continue;

                    if (clippedSegments) clippedSegments.push({ segment: clipped.segment, depth: count });
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
        
        // Brute-force iterate dirty edges from current geometry
        if (dirtyEdges) {
            const dirtyEdgeList = collectDirtyEdges(this.wallGeometry, dirtyEdges);
            for (const e of dirtyEdgeList) {
                if (e.material == null) continue;
                const clipped = clip(e, this.camera);
                if (clipped === NULL_EDGE) continue;
                
                if (clippedSegments) clippedSegments.push({ segment: clipped.segment, depth: count });
                dirtyEdgesTested++;
                edgesTested++;
                this.buffer.add(clipped, e.start.vector);
            }
        }

        // draw floor + sky
        const startDrawing = performance.now();
        // this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawSky();
        this.drawFloor();
        const afterBackground = performance.now();

        // Per-polygon floor/ceiling rendering
        if (this.visiblePolygons.length > 0) {
            const grid = buildPolygonGrid(this.visiblePolygons);
            const columnBounds = buildColumnBounds(
                (col) => this.buffer.getNearestWallBoundsForColumn(col),
                this.resolution,
                this.height,
            );
            const floorConfig: IFloorRendererConfig = {
                screenWidth: this.width,
                screenHeight: this.height,
                halfHeightConstant: 5, // half of the 10 in wallHeight = 10 * screenHeight / distance
            };
            renderFloors(
                this.context,
                this.camera,
                this.buffer.getRays(),
                columnBounds,
                grid,
                floorConfig,
                this.worldConfig,
                textureLib,
            );
        }
        const afterFloorCeiling = performance.now();

        // Pixel-based wall rendering: pass column data directly to the new renderer
        renderWalls(
            this.context,
            this.buffer.getColumns(),
            this.width,
            this.height,
            this.worldConfig,
            textureLib,
        );
        const endDrawing = performance.now();
        
        if (!this.lastUpdated || endDrawing - this.lastUpdated > 1000) {
            this.lastUpdated = endDrawing;
            dispatch(statisticsUpdated({
                performance: {
                    timing: {
                        drawing: endDrawing - startDrawing,
                        casting: 0,
                        zbuffering: startDrawing - startZBuffering,
                        total: endDrawing - startZBuffering,
                        background: afterBackground - startDrawing,
                        floorCeiling: afterFloorCeiling - afterBackground,
                        wallRendering: endDrawing - afterFloorCeiling,
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
                detectedEdges: clippedSegments || [],
                bspRendering: {
                    staleEdgesSkipped,
                    dirtyEdgesTested,
                    edgesTested,
                }
            }));
        }

    }

    private drawSky = () => {
        if (this.skyboxRenderer.draw(this.context, this.camera, this.worldConfig, this.canvas.width, this.canvas.height)) {
            return;
        }
        const gradient = this.worldConfig.skyGradient;
        if (gradient) {
            const skyHeight = this.canvas.height / 2;
            const g = createSkyGradient(this.context, gradient, this.canvas.width, skyHeight);
            drawRect(this.context, [[0, 0], [this.canvas.width, skyHeight]], g);
            return;
        }
        const [r, g, b] = this.worldConfig.skyColor ?? DEFAULT_SKY_COLOR;
        this.drawBackground(`rgb(${r},${g},${b})`, 0, this.canvas.height / 2);
    };
    private drawFloor = () => {
        const [r, g, b] = this.worldConfig.floorColor ?? DEFAULT_FLOOR_COLOR;
        this.drawBackground(`rgb(${r},${g},${b})`, this.canvas.height / 2, this.canvas.height);
    };
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
    // Additional cached values for direct screen projection (optimization 1.3)
    private screenDirX: number;
    private screenDirY: number;
    private invScreenLength: number;
    private planeNumerator: number; // plane.d - dot(plane.n, cameraPos), constant per frame
    
    constructor(private resolution: number, private camera: ICamera, private wallPainter: WallPainter, private context: CanvasRenderingContext2D) {
        this.cols = Array.from({ length: resolution }, () => new ZBufferColumn());
        this.rays = makeRays(this.resolution, this.camera);
        this.updateCachedValues();
    }
    
    private updateCachedValues(): void {
        this.screenLength = segmentLength(this.camera.screen);
        this.screenPlane = createPlane(this.camera.screen);
        this.screenLeft = this.camera.screen[0];
        // Cache screen direction (normalized) and inverse length for direct projection
        const sl = this.screenLength;
        const sx = this.camera.screen[1][0] - this.camera.screen[0][0];
        const sy = this.camera.screen[1][1] - this.camera.screen[0][1];
        this.screenDirX = sx / sl;
        this.screenDirY = sy / sl;
        this.invScreenLength = 1 / sl;
        // Pre-compute the plane numerator: plane.d - dot(plane.n, cameraPos)
        const p = this.screenPlane;
        this.planeNumerator = p.d - (p.n[0] * this.camera.position[0] + p.n[1] * this.camera.position[1]);
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
        // Direct screen projection: project edge endpoints onto screen without constructing IRay objects
        // For each endpoint, compute ray-plane intersection parameter t, then project along screen line
        const camX = this.camera.position[0];
        const camY = this.camera.position[1];
        const pn = this.screenPlane.n;
        const slX = this.screenLeft[0];
        const slY = this.screenLeft[1];
        
        // Project start vertex
        const sdx = edge.start.vector[0] - camX;
        const sdy = edge.start.vector[1] - camY;
        const sdenom = pn[0] * sdx + pn[1] * sdy;
        if (Math.abs(sdenom) < 1e-10) return;
        const st = this.planeNumerator / sdenom;
        const six = camX + st * sdx - slX;
        const siy = camY + st * sdy - slY;
        const sScreenX = six * this.screenDirX + siy * this.screenDirY;
        
        // Project end vertex
        const edx = edge.end.vector[0] - camX;
        const edy = edge.end.vector[1] - camY;
        const edenom = pn[0] * edx + pn[1] * edy;
        if (Math.abs(edenom) < 1e-10) return;
        const et = this.planeNumerator / edenom;
        const eix = camX + et * edx - slX;
        const eiy = camY + et * edy - slY;
        const eScreenX = eix * this.screenDirX + eiy * this.screenDirY;
        
        let scol = Math.ceil(sScreenX * this.invScreenLength * this.resolution);
        let ecol = Math.floor(eScreenX * this.invScreenLength * this.resolution);
        
        [scol, ecol] = [Math.max(0, Math.min(scol,ecol)-1), Math.min(this.resolution, Math.max(scol, ecol)+1)];
        if (ecol <= scol) return;
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
        for (const c of this.cols) {
            if (!c.isFull()) return false;
        }
        return true;
    }

     public clear(): void {
        for (let i = 0; i < this.cols.length; i++) {
            this.cols[i].clear();
        }
    }

    /**
     * Get the nearest wall's row range for a specific column, or null if empty.
     * Used by the floor/ceiling renderer.
     */
    public getNearestWallBoundsForColumn(col: number): [number, number] | null {
        return this.cols[col]?.getNearestWallBounds() ?? null;
    }

    /**
     * Get the camera rays array.
     */
    public getRays(): IRay[] {
        return this.rays;
    }

    /**
     * Get the column data for the pixel-based wall renderer.
     */
    public getColumns(): ZBufferColumn[] {
        return this.cols;
    }

    public updateCamera(camera: ICamera): void {
        this.camera = camera;
        this.rays = makeRays(this.resolution, this.camera);
        this.updateCachedValues();
    }
}
export class ZBufferColumn {
    // T3.8: Sorted array replaces PriorityDeque — columns typically have 1-3 walls,
    // so linear insertion sort beats heap overhead. Array is sorted ascending by distance.
    private _walls: WallProps[] = [];
    private _count: number = 0;
    private hasOpaqueWall: boolean = false;  // Track if any wall has alpha === 1
    
    constructor() {}

    /** Number of walls currently stored in this column */
    public get count(): number { return this._count; }

    /** The walls array (sorted ascending by distance). Only indices 0.._count-1 are valid. */
    public get walls(): WallProps[] { return this._walls; }

    public clear(): void {
        this._count = 0;
        this.hasOpaqueWall = false;
    }

    public isFull(): boolean {     
        return this.hasOpaqueWall;
    }
    
    public add(el: WallProps): ZBufferColumn {        
        // Insert into sorted position (ascending by distance).
        // For typical 1-3 walls, linear scan from end is optimal.
        const d = el.distance;
        let i = this._count;
        // Ensure array has room (reuse slots from previous frame)
        if (i >= this._walls.length) {
            this._walls.push(el);
        } else {
            this._walls[i] = el;
        }
        // Insertion sort: shift elements right to maintain ascending order
        while (i > 0 && this._walls[i - 1].distance > d) {
            this._walls[i] = this._walls[i - 1];
            i--;
        }
        this._walls[i] = el;
        this._count++;
        
        // Track if we have any opaque wall (alpha === 1)
        if (!this.hasOpaqueWall && (el.material?.color[3] || 0) === 1) {
            this.hasOpaqueWall = true;
        }
        return this;
    }

    /**
     * Get the nearest OPAQUE wall's row range [top, bottom], or null if none exists.
     * Used by the floor/ceiling renderer to determine where to stop rendering.
     * Translucent walls are skipped because floors/ceilings are visible through them —
     * the rendering order (floor/ceiling first, then walls back-to-front) ensures
     * translucent walls composite correctly over the floor/ceiling underneath.
     */
    public getNearestWallBounds(): [number, number] | null {
        for (let i = 0; i < this._count; i++) {
            if ((this._walls[i].material?.color[3] || 0) === 1) {
                return this._walls[i].rowRange;
            }
        }
        return null;
    }

    public shift(): WallProps {
        // Pop from end = largest distance = farthest wall (back-to-front rendering)
        if (this._count === 0) return undefined;
        return this._walls[--this._count];
    }

    public render(painter: WallPainter): void {
        // Render back-to-front (farthest first = pop from end)
        while (this._count > 0) {
            painter.drawWall([this._walls[--this._count]]);
        }
    }
}
