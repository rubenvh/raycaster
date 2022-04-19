import { EMPTY_GEOMETRY } from '../../geometry/geometry';
import { cloneKey, createEntityKey, IEntityKey } from '../../geometry/entity';
import { makeRays, DEFAULT_CAMERA, ICamera } from '../../camera';
import { drawRect, drawSegment, drawTrapezoid, drawVector } from '../../drawing/drawing';
import { Guid } from 'guid-typescript';
import { Intersection, intersectRayPlane, intersectRaySegment, IRay, lookupMaterialFor, makeRay, RayHit } from '../../geometry/collision';
import { norm, subtract, Vector } from '../../math/vector';
import { Face, IMaterial } from '../../geometry/properties';
import { statisticsUpdated } from '../../store/stats';
import { useAppDispatch } from '../../store';
import { connect } from '../../store/store-connector';
import { IWorldConfigState } from '../../store/world-config';
import { textureLib, TextureLibrary } from '../../textures/textureLibrary';
import { Texture } from '../../textures/texture';
import { IRenderer } from '../renderer';
import { cloneEdge, IEdge, makeEdge, NULL_EDGE } from '../../geometry/edge';
import { walk } from '../../geometry/bsp/querying';
import { classifyPointToPlane } from '../../geometry/bsp/classification';
import { PointToPlaneRelation } from '../../geometry/bsp/model';
import { distance } from '../../geometry/vertex';
import { createPlane, intersectSegmentPlane } from '../../math/plane';
import { lineAngle, lineIntersect, segmentLength } from '../../math/lineSegment';
import { convertDistanceToWallHeight, drawWall, WallProps } from '../common/wall-drawing';
import { castRaysOnEdge } from '../raycasting/raycaster';
import { WallPainter } from '../../drawing/wall-painter';
import { Heap } from '../../datastructures/heap';

const dispatch = useAppDispatch();

export class ZBufferRenderer implements IRenderer {

    private context: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private resolution = 640;
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private wallPainter: WallPainter;

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
        });
    }


    public isActive(): boolean {
        return !!this.wallGeometry.bsp
    }

    render(fps: number): void {

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);


        // const cone = makeRays(1, this.camera);
        // drawSegment(this.context, cone[0].line);
        // drawSegment(this.context, cone[1].line);

        let buffer = new ZBuffer(this.resolution, this.camera, this.wallPainter);

        // TODO: pass direction into walk function so we can use it to ignore entire branch in some cases
        walk(this.wallGeometry.bsp, this.camera.position, (ps => {
            for (let p of ps) {
                for (let e of p.edges) {
                    const clipped = this.clip(e);
                    if (clipped === NULL_EDGE) continue;

                    buffer.add(clipped);
                }
            }
            return !buffer.isFull();
        }))


        buffer.render();
    }

    private clip = (e: IEdge): IEdge => {
        if (classifyPointToPlane(e.start.vector, this.camera.planes.camera) === PointToPlaneRelation.InFront
            || classifyPointToPlane(e.end.vector, this.camera.planes.camera) === PointToPlaneRelation.InFront) {
            let [sl, sr, el, er] = [
                classifyPointToPlane(e.start.vector, this.camera.planes.left),
                classifyPointToPlane(e.start.vector, this.camera.planes.right),
                classifyPointToPlane(e.end.vector, this.camera.planes.left),
                classifyPointToPlane(e.end.vector, this.camera.planes.right)];
            
            let outsideView = sl === sr && el === er && sl === el;
            if (outsideView) { return NULL_EDGE; }

            let clipBoth = sl === sr && el === er && sl !== el; // completely crossing view (need clipping)
            let clipStart = clipBoth || sl === sr && el !== er;
            let clipEnd = clipBoth || sl !== sr && el === er;

            return cloneEdge(e,
                clipStart ? intersectRaySegment(this.camera.cone.left, e.segment)?.point ?? intersectRaySegment(this.camera.cone.right, e.segment)?.point : null,
                clipEnd ? intersectRaySegment(this.camera.cone.right, e.segment)?.point ?? intersectRaySegment(this.camera.cone.left, e.segment)?.point : null);
        }
        return NULL_EDGE;
    }

}

export class ZBuffer {
    private cols: ZBufferColumn[];
    private fullCols = 0;
    private rays: IRay[];

    constructor(private resolution: number, private camera: ICamera, private wallPainter: WallPainter) {
        this.cols = Array.from({ length: resolution }, (v, i) => new ZBufferColumn(i));
        this.rays = makeRays(this.resolution, this.camera);
    }

    public render(): void {
        for (let col of this.cols) {
            col.render();
        }
    }

    public add(edge: IEdge): void {        
        
        let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));
        let eray = makeRay(this.camera.position, subtract(edge.end.vector, this.camera.position));
        let sproj = intersectRaySegment(sray, this.camera.screen)?.point;
        let eproj = intersectRaySegment(eray, this.camera.screen)?.point;        
        if (!sproj || !eproj){ return; }
                
        let [pl,] = this.camera.screen;
        let screenLength = segmentLength(this.camera.screen);
        let scol = Math.round(distance(pl, sproj)/screenLength * this.resolution);
        let ecol = Math.round(distance(pl, eproj)/screenLength * this.resolution);
        
        [scol, ecol] = [Math.min(scol,ecol), Math.max(scol, ecol)];        
        let rays = this.rays.slice(scol, ecol);    
        let hits = castRaysOnEdge(rays, edge);
        let i = 0;
        for (let c of hits) {
            const wall = this.wallPainter.createWall(c, scol+i );            
            this.cols[scol+i].add({
                isOpaque: (wall.material?.color[3]||0) === 1, 
                distance: c.distance,
                render: () => this.wallPainter.drawWall([wall])
            });            
            i++;
        }            
    }

    public isFull(): boolean {   
        return this.cols.every(c => c.isFull());     
    }
}
export class ZBufferColumn {
    //private stack: ZBufferElement[];
    private heap: Heap<ZBufferElement>;
    constructor(private col: number) {
        //this.stack = [];
        this.heap = new Heap<ZBufferElement>([], (a, b) => a.distance - b.distance);
    }

    public isFull(): boolean {
        return this.heap.heapSize > 0 && this.heap.max().isOpaque;
        //return this.stack.length > 0 && this.stack[this.stack.length - 1].isOpaque;
    }

    public add(el: ZBufferElement): ZBufferColumn {
        if (this.heap.heapSize === 0 || !this.heap.max().isOpaque) {
            this.heap.insert(el);
        }
        // if (this.stack.length === 0 || !this.stack[this.stack.length - 1].isOpaque) {
        //     this.stack.push(el);
        // }
        return this;
    }

    public render(): void {
        while (this.heap.heapSize > 0) {
            this.heap.extractMax().render();
        }
        // while (this.stack.length > 0) {
        //     const el = this.stack.pop();
        //     el.render();
        // }
    }
}
export type ZBufferElement = {
    isOpaque: boolean;
    distance: number;
    render: () => void;
}

