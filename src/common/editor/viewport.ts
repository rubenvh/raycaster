import { Vector } from "../math/vector";
import { Colors } from "./colors";
import { Grid } from "./grid";
import { ScrollBar } from "./scrollBar";

export class ViewPort {
    
    private SCROLL_SIZE: number = 100;
    private context: CanvasRenderingContext2D;
    private horizontalScroll: ScrollBar;
    private verticalScroll: ScrollBar;
    private grid: Grid;
    private elemLeft: number;
    private elemTop: number;
    public scale: number = 1;
    
    get scrollX() { return this.horizontalScroll.position; }
    get scrollY() { return this.verticalScroll.position; }
        
    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.grid = new Grid(this.context, canvas.width, canvas.height);
        this.horizontalScroll = new ScrollBar(true, this.canvas.width, this.canvas.width-10);
        this.verticalScroll = new ScrollBar(false, this.canvas.height, this.canvas.height-10);
        this.elemLeft = canvas.offsetLeft + canvas.clientLeft;
        this.elemTop = canvas.offsetTop + canvas.clientTop;
        this.canvas.addEventListener('wheel', (ev: WheelEvent) => {
            if (ev.ctrlKey) { return; }
            ev.preventDefault();   

            const sign = ev.deltaY<0?-1:1;            
            const [deltaX, deltaY] = ev.shiftKey ? [this.SCROLL_SIZE*sign, 0] : [0, this.SCROLL_SIZE*sign];
            this.horizontalScroll.scroll(deltaX);
            this.verticalScroll.scroll(deltaY);
            
            this.adaptView(1);
        });

        this.canvas.addEventListener('wheel', (ev: WheelEvent) => {
            if (!ev.ctrlKey) { return; }            
            ev.preventDefault();   

            const [x, y] = this.toWorldSpace([ev.pageX - this.elemLeft, ev.pageY - this.elemTop]);            
            const zoomOut = ev.deltaY<0;
            const factor = zoomOut?0.9:1.1;            
            if ( factor * this.scale < 0.1) { return; }
            this.scale = factor * this.scale;                        
            this.horizontalScroll.resize(this.canvas.width/this.scale, this.canvas.width-10, this.scale);
            this.verticalScroll.resize(this.canvas.height/this.scale, this.canvas.height-10, this.scale);       
            
            const [vx, vy] = this.toViewPortSpace([x, y]);
            const [nx, ny] = this.toWorldSpace([Math.max(0, vx - this.canvas.width/this.scale/2), Math.max(0, vy - this.canvas.height/this.scale/2)]);            
            this.horizontalScroll.scrollTo(nx);
            this.verticalScroll.scrollTo(ny);           

            this.adaptView(factor);            
        });
    }

    private adaptView = (scaleFactor: number) => {
        this.context.scale(scaleFactor, scaleFactor);            
        this.context.setTransform(
            this.scale, 0,
            0, this.scale,
            -1 * this.horizontalScroll.position, 
            -1 * this.verticalScroll.position);
        this.grid.adaptGrid(...this.toWorldSpace([this.canvas.width, this.canvas.height]));
    }
    public toWorldSpace = (position: Vector): Vector  => 
        [Math.ceil((position[0] + this.scrollX) / this.scale),
         Math.ceil((position[1] + this.scrollY) / this.scale)];

    public toViewPortSpace = (position: Vector): Vector => 
        [this.scale * position[0] - this.scrollX,
        this.scale * position[1] - this.scrollY];

    public setBounds = (bounds: Vector) => {
        this.horizontalScroll.setBoundary(bounds[0]);
        this.verticalScroll.setBoundary(bounds[1]);
    }
    public reset = () => { 
        this.scale = 1;
        this.horizontalScroll.resize(this.canvas.width, this.canvas.width-10);
        this.verticalScroll.resize(this.canvas.height, this.canvas.height-10);
        this.horizontalScroll.reset(); 
        this.verticalScroll.reset();         
        this.adaptView(this.scale);
    }

    private clearView = () => this.context.clearRect(...this.toWorldSpace([0,0]), ...this.toWorldSpace([this.canvas.width,this.canvas.height]));
    public drawBackground = () => {
        this.clearView();
        this.grid.draw(...this.toWorldSpace([0,0]), ...this.toWorldSpace([this.canvas.width,this.canvas.height]));
    };
    public drawForeground = () => {
        //TODO: make use of toWorldspace here for determining location of scrollbar
        this.horizontalScroll.draw(this.context, this.verticalScroll.position+this.canvas.height-10, this.scale);
        this.verticalScroll.draw(this.context, this.horizontalScroll.position+this.canvas.width-10, this.scale);
    }
}
