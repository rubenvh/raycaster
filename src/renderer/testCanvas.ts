import { Vector } from './../common/math/vector';
import { drawSegment, drawVector } from "../common/drawing/drawing";
import { createPlane, intersectSegmentPlane } from "../common/math/plane";
import { connect } from "../common/store/store-connector";

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

            
            const plane_segment: [Vector, Vector] = [[500,100],[450,150]];
            const plane = createPlane(plane_segment);            
            drawSegment(this.context, plane_segment);

            const target_segment: [Vector, Vector] = [[300,20],[350,400]];
            drawSegment(this.context, target_segment);

            const i = intersectSegmentPlane(target_segment, plane);

            if (i.q) {
                drawVector(this.context, i.q, 'rgb(0,255,0)');
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