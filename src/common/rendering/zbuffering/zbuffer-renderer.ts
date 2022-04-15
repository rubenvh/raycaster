import { EMPTY_GEOMETRY } from '../../geometry/geometry';
import { cloneKey, createEntityKey, IEntityKey } from '../../geometry/entity';
import { makeRays, DEFAULT_CAMERA, ICamera } from '../../camera';
import { drawRect, drawTrapezoid } from '../../drawing/drawing';
import { Guid } from 'guid-typescript';
import { intersectRaySegment, lookupMaterialFor, makeRay, RayHit } from '../../geometry/collision';
import { Vector } from '../../math/vector';
import { IMaterial } from '../../geometry/properties';
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

const dispatch = useAppDispatch();

export class ZBufferRenderer implements IRenderer {

    private context: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    private resolution = 640;
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
            this.worldConfig = s.worldConfig;
            if (this.wallGeometry != s.walls.geometry) {
                this.wallGeometry = s.walls.geometry;
            }
        });
    }


    public isActive(): boolean {
        return !!this.wallGeometry.bsp
    }

    render(fps: number): void {

        let buffer = new ZBuffer(this.resolution, this.camera);
        // TODO: pass direction into walk function so we can use it to ignore entire branch in some cases
        walk(this.wallGeometry.bsp, this.camera.position, (ps => {
            for (let p of ps) {
                for (let e of p.edges) {
                    buffer.add(this.clip(e));

                    if (buffer.isFull()) return false;
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

            let clipBoth = sl === sr && el === er && sl !== el; // completely crossing view (need clipping)
            let clipStart = clipBoth || sl === sr && el !== er;
            let clipEnd = clipBoth || sl !== sr && el === er;

            return cloneEdge(e,
                clipStart ? intersectRaySegment(this.camera.cone.left, e.segment)?.point : null,
                clipEnd ? intersectRaySegment(this.camera.cone.right, e.segment)?.point : null);
        }
        return NULL_EDGE;
    }

}

export class ZBuffer {
    private cols: ZBufferColumn[];
    constructor(private resolution: number, private camera: ICamera) {
        this.cols = Array.from({ length: resolution }, (v, i) => new ZBufferColumn(i));
    }

    public render(): void {
        for (let col of this.cols) {
            col.render();
        }
    }

    public add(edge: IEdge): void {
        let d1 = distance(edge.start, this.camera.position); // * Math.cos(angle);
        let d2 = distance(edge.end, this.camera.position); // * Math.cos(angle);


        // TODO: implement
    }

    public isFull(): boolean {
        // TODO: implement
        return false;
    }
}
export class ZBufferColumn {
    private stack: ZBufferElement[];
    constructor(private col: number) {
        this.stack = [];
    }

    public isFull(): boolean {
        return this.stack.length > 0 && this.stack[this.stack.length - 1].isOpaque;
    }

    public add(el: ZBufferElement): ZBufferColumn {
        if (this.stack.length === 0 || !this.stack[this.stack.length - 1].isOpaque) {
            this.stack.push(el);
        }
        return this;
    }

    public render(): void {
        while (this.stack.length > 0) {
            const el = this.stack.pop();
            el.render();
        }
    }
}
export type ZBufferElement = {
    isOpaque: boolean;
    render: () => void;
}