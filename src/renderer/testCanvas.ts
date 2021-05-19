import { intersectRayPlane, makeRay } from './../common/geometry/collision';
import { add, scale, Vector } from './../common/math/vector';
import { drawSegment, drawVector } from "../common/drawing/drawing";
import { createPlane, intersectSegmentPlane } from "../common/math/plane";
import { connect } from "../common/store/store-connector";
import { Face } from '../common/geometry/properties';
import { classifyPointToPlane } from '../common/geometry/bsp/classification';
import { PointToPlaneRelation } from '../common/geometry/bsp/model';

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

            
            const plane_segment: [Vector, Vector] = [[480,100],[500,150]];
            const plane = createPlane(plane_segment);            
            drawSegment(this.context, plane_segment);

            const target_segment: [Vector, Vector] = [[480,105],[600,80]];
            drawSegment(this.context, target_segment);

            // const i = intersectSegmentPlane(target_segment, plane);

            // if (i.q) {
            //     drawVector(this.context, i.q, 'rgb(0,255,0)');
            // }

            // const ray = makeRay([100,500], [1,-0.1]);
            // drawVector(this.context, ray.position);
            // drawVector(this.context, ray.direction);
            // drawSegment(this.context, [ray.position, add(ray.position, scale(100, ray.dn))]);
            
            const i = intersectSegmentPlane(target_segment, plane);

            const c1 = classifyPointToPlane(target_segment[0], plane);
            drawVector(this.context, target_segment[0], c1 === PointToPlaneRelation.Behind ? 'red' : c1 === PointToPlaneRelation.InFront ? 'blue' : 'green');
            const c2 = classifyPointToPlane(target_segment[1], plane);
            drawVector(this.context, target_segment[1], c2 === PointToPlaneRelation.Behind ? 'red' : c2 === PointToPlaneRelation.InFront ? 'blue' : 'green');
            if (i.q) {
                const c3 = classifyPointToPlane(i.q, plane);
                drawVector(this.context, i.q, c3 === PointToPlaneRelation.Behind ? 'red' : c3 === PointToPlaneRelation.InFront ? 'blue' : 'green');
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