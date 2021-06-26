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
    public scale: number = 1;
    
    get scrollX() { return this.horizontalScroll.position; }
    get scrollY() { return this.verticalScroll.position; }
        
    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.grid = new Grid(this.context, canvas.width, canvas.height);
        this.horizontalScroll = new ScrollBar(true, this.canvas.width, this.canvas.width-10);
        this.verticalScroll = new ScrollBar(false, this.canvas.height, this.canvas.height-10);
        this.canvas.addEventListener('wheel', (ev: WheelEvent) => {
            if (ev.ctrlKey) { return; }
            ev.preventDefault();   

            const sign = ev.deltaY<0?-1:1;            
            const [deltaX, deltaY] = ev.shiftKey ? [this.SCROLL_SIZE*sign, 0] : [0, this.SCROLL_SIZE*sign];
            if ((this.horizontalScroll.position+deltaX < 0) ||  this.verticalScroll.position+deltaY < 0) {
                return;
            }

            this.horizontalScroll.scroll(deltaX);
            this.verticalScroll.scroll(deltaY);
            
            this.context.setTransform(
                this.scale, 0,
                0, this.scale,
                -1 * this.horizontalScroll.position, 
                -1 * this.verticalScroll.position);   
            this.grid.adaptGrid(...this.toWorldSpace([this.canvas.width, this.canvas.height]));
        });

        this.canvas.addEventListener('wheel', (ev: WheelEvent) => {
            if (!ev.ctrlKey) { return; }            
            ev.preventDefault();   

            const factor = ev.deltaY<0?0.9:1.1;            
            
            this.scale = factor * this.scale;                        
            this.horizontalScroll.resize(this.canvas.width/this.scale, this.canvas.width-10);
            this.verticalScroll.resize(this.canvas.height/this.scale, this.canvas.height-10);       
            
            this.context.scale(factor, factor);            
            this.grid.adaptGrid(...this.toWorldSpace([this.canvas.width, this.canvas.height]));
        });
    }
    public toWorldSpace = (position: Vector): Vector  => 
        [Math.floor((position[0] + this.scrollX) / this.scale),
         Math.floor((position[1] + this.scrollY) / this.scale)];

    public setBounds = (bounds: Vector) => {

        this.horizontalScroll.setBoundary(bounds[0]);
        this.verticalScroll.setBoundary(bounds[1]);
    }
    public reset = () => { 
        this.horizontalScroll.resize(this.canvas.width, this.canvas.width-10);
        this.horizontalScroll.reset(); 
        this.verticalScroll.reset(); 
        this.verticalScroll.resize(this.canvas.height, this.canvas.height-10);
        this.grid.adaptGrid(...this.toWorldSpace([this.canvas.width, this.canvas.height]));
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
