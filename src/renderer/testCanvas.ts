import { createPolygon } from './../common/geometry/polygon';
import { intersectRayPlane, makeRay } from './../common/geometry/collision';
import { add, scale, Vector } from './../common/math/vector';
import { drawSegment, drawVector } from "../common/drawing/drawing";
import { createPlane, intersectSegmentPlane } from "../common/math/plane";
import { connect } from "../common/store/store-connector";
import { Face } from '../common/geometry/properties';
import { classifyPointToPlane } from '../common/geometry/bsp/classification';
import { PointToPlaneRelation } from '../common/geometry/bsp/model';
import { normal } from '../common/math/lineSegment';
import { splitPolygon } from '../common/geometry/bsp/splitting';

export class TestCanvasRenderer {    
    private background: HTMLCanvasElement;
    private active: boolean = false;
    
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


            const p = createPolygon([[100,100],[200,100],[200,200],[100,200]]);
            const plane_segment: [Vector, Vector] = [[120,0],[130,80]];
            const plane = createPlane(plane_segment);            
            drawSegment(this.context, plane_segment);

            const [front, back] = splitPolygon(p, plane);

            // for (const e of front.edges) {
            //     // draw normal to selected edge:
            //     drawSegment(this.context, normal(e.segment, 10), 'rgb(0,100,255)', 1);
            //     drawSegment(this.context, [e.start.vector, e.end.vector], 'rgba(155,0,0,0.7)', 1);
            // }
            for (const e of back.edges) {
                // draw normal to selected edge:
                drawSegment(this.context, normal(e.segment, 10), 'rgb(0,100,255)', 1);
                drawSegment(this.context, [e.start.vector, e.end.vector], 'rgba(0,0,155,0.7)', 1);
            }
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