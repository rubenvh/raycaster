import { createPolygon, IPolygon } from './../common/geometry/polygon';
import { intersectRayPlane, intersectRaySegment, makeRay } from './../common/geometry/collision';
import { add, scale, subtract, Vector } from './../common/math/vector';
import { drawPlane, drawSegment, drawVector } from "../common/drawing/drawing";
import { createPlane, intersectSegmentPlane, VOID_PLANE } from "../common/math/plane";
import { connect } from "../common/store/store-connector";
import { Face } from '../common/geometry/properties';
import { classifyPointToPlane } from '../common/geometry/bsp/classification';
import { PointToPlaneRelation } from '../common/geometry/bsp/model';
import { normal } from '../common/math/lineSegment';
import { pickSplittingPlane, splitPolygon } from '../common/geometry/bsp/splitting';
import { IGeometry } from '../common/geometry/geometry';
import { clip, ICamera, makeRays } from '../common/camera';
import { findClosest, walk } from '../common/geometry/bsp/querying';
import { IEdge, NULL_EDGE } from '../common/geometry/edge';

export class TestCanvasRenderer {
    private background: HTMLCanvasElement;
    private active: boolean = false;
    private geometry: IGeometry;
    private camera: ICamera;
    private tp: IPolygon;

    constructor(private canvas: HTMLCanvasElement, private context?: CanvasRenderingContext2D) {
        this.context = this.context || canvas.getContext('2d');
        this.background = document.createElement('canvas') as HTMLCanvasElement;
        this.resizeCanvas();
        window.addEventListener('resize', e => {
            e.preventDefault();
            this.resizeCanvas();
        });
        connect(s => {
            this.active = !!s.uiConfig.enableTestCanvas;
            this.geometry = s.walls.geometry;
            this.camera = s.player.camera;
        });

        // const a: Vector[] = [
        //     [400, 120],
        //     [420, 120],
        //     [460, 120],
        //     [450, 160],
        //     [439, 173],
        //     [463, 222],
        //     [489.68965517241384, 224.72413793103448],
        //     [537, 194],
        //     [519.24, 120]
        // ];
        // this.tp = createPolygon(a);
    }

    private resizeCanvas = (): void => {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.background.width = this.canvas.width;
        this.background.height = this.canvas.height;
        this.initGrid();
    }


    public render = (fps: number) => {
        if (this.active) {
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.drawGrid();

            // this.tp.edges.forEach(e => {
            //     drawSegment(this.context, e.segment, 'rgb(255,0,0)', 2);
            // });
            // let plane = pickSplittingPlane([this.tp], 0, VOID_PLANE);
            // drawPlane(this.context, plane, 'rgb(0,0,255)', [], [this.canvas.width, this.canvas.height]);


            const cone = makeRays(1, this.camera);
            drawSegment(this.context, cone[0].line);
            drawSegment(this.context, cone[1].line);

            // let depth = 40;
            // let count = 0;
            // // TODO: pass direction into walk function so we can use it to ignore entire branch in some cases
            // walk(this.geometry.bsp, this.camera.position, (ps => {
            //     ps.forEach(p => {

            //         let increment = 0;
            //         p.edges.forEach(e => {

            //             let clipped = clip(e, this.camera);
            //             if (clipped !== NULL_EDGE) {
            //                 const c = 255 - count * 255 / depth;
            //                 drawSegment(this.context, clipped.segment, `rgb(${c},${c},${c})`, 2);
            //                 increment = increment || 1;
            //             }
            //         });
            //         count = count + increment;
            //     });
            //     return count <= depth;
            // }))
        }
    };

    
    private initGrid = () => {
        this.background.width = this.canvas.width;
        this.background.height = this.canvas.height;
        const backgroundContext = this.background.getContext('2d');
        backgroundContext.beginPath();
        backgroundContext.lineWidth = 1;
        backgroundContext.setLineDash([4, 2]);
        backgroundContext.strokeStyle = 'rgb(0,0,0)';
        for (let x = 0; x <= backgroundContext.canvas.width; x += 20) {
            backgroundContext.moveTo(x, 0);
            backgroundContext.lineTo(x, backgroundContext.canvas.height);
            for (let y = 0; y <= backgroundContext.canvas.height; y += 20) {
                backgroundContext.moveTo(0, y);
                backgroundContext.lineTo(backgroundContext.canvas.width, y);
            }
        }
        backgroundContext.stroke();
    };

    private drawGrid = () => this.context.drawImage(this.background, 0, 0);
}