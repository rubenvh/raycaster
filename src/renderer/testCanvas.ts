import { createPolygon } from './../common/geometry/polygon';
import { intersectRayPlane, intersectRaySegment, makeRay } from './../common/geometry/collision';
import { add, scale, subtract, Vector } from './../common/math/vector';
import { drawSegment, drawVector } from "../common/drawing/drawing";
import { createPlane, intersectSegmentPlane } from "../common/math/plane";
import { connect } from "../common/store/store-connector";
import { Face } from '../common/geometry/properties';
import { classifyPointToPlane } from '../common/geometry/bsp/classification';
import { PointToPlaneRelation } from '../common/geometry/bsp/model';
import { normal } from '../common/math/lineSegment';
import { splitPolygon } from '../common/geometry/bsp/splitting';
import { IGeometry } from '../common/geometry/geometry';
import { ICamera, makeRays } from '../common/camera';
import { findClosest, walk } from '../common/geometry/bsp/querying';
import { IEdge } from '../common/geometry/edge';

export class TestCanvasRenderer {
    private background: HTMLCanvasElement;
    private active: boolean = false;
    private geometry: IGeometry;
    private camera: ICamera;

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

            const cone = makeRays(1, this.camera);
            drawSegment(this.context, cone[0].line);
            drawSegment(this.context, cone[1].line);

            let depth = 10;
            let count = 0;
            walk(this.geometry.bsp, this.camera.position, (ps => {
                ps.forEach(p => {

                    p.edges.forEach(e => {
                        if (this.isInView(e)) {
                            const c = 255 - count * 255 / depth;
                            drawSegment(this.context, e.segment, `rgb(${c},${c},${c})`, 2);
                            count++;
                        }



                    })
                });
                return count <= depth;
            }))
        }
    };

    private isInView = (e: IEdge): boolean => {
        if (classifyPointToPlane(e.start.vector, this.camera.planes.camera) === PointToPlaneRelation.InFront
            || classifyPointToPlane(e.end.vector, this.camera.planes.camera) === PointToPlaneRelation.InFront) {
            let [c1, c2, c3, c4] = [
                classifyPointToPlane(e.start.vector, this.camera.planes.left),
                classifyPointToPlane(e.start.vector, this.camera.planes.right),
                classifyPointToPlane(e.end.vector, this.camera.planes.left),
                classifyPointToPlane(e.end.vector, this.camera.planes.right)];

            return (c1 === c2 && c3 === c4 && c1 !== c3 || c1 !== c2 || c3 !== c4)
        }
        return false;
    }
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