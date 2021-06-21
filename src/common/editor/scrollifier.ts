import { maximumComponents, Vector } from "../math/vector";
import { ScrollBar } from "./scrollBar";

export class Scrollifier {
    
    private SCROLL_SIZE: number = 100;
    private context: CanvasRenderingContext2D;
    private horizontalScroll: ScrollBar;
    private verticalScroll: ScrollBar;

    get scrollX() { return this.horizontalScroll.position; }
    get scrollY() { return this.verticalScroll.position; }
        
    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.horizontalScroll = new ScrollBar(true, this.canvas.width, this.canvas.width-10);
        this.verticalScroll = new ScrollBar(false, this.canvas.height, this.canvas.height-10);
        this.canvas.addEventListener('wheel', (ev: WheelEvent) => {
            ev.preventDefault();   

            const sign = ev.deltaY<0?-1:1;            
            const [deltaX, deltaY] = ev.shiftKey ? [this.SCROLL_SIZE*sign, 0] : [0, this.SCROLL_SIZE*sign];
            if ((this.horizontalScroll.position+deltaX < 0) ||  this.verticalScroll.position+deltaY < 0) {
                return;
            }

            this.horizontalScroll.scroll(deltaX);
            this.verticalScroll.scroll(deltaY);
            this.context.setTransform(
                1, 0,
                0, 1,
                -1 * this.horizontalScroll.position, 
                -1 * this.verticalScroll.position);
        });
    }

    public setBounds = (bounds: Vector) => {

        this.horizontalScroll.setBoundary(bounds[0]);
        this.verticalScroll.setBoundary(bounds[1]);
    }
    public reset = () => { 
        this.horizontalScroll.resize(this.canvas.width, this.canvas.width-10);
        this.horizontalScroll.reset(); 
        this.verticalScroll.reset(); 
        this.verticalScroll.resize(this.canvas.height, this.canvas.height-10);

    }
    public clearView = () => this.context.clearRect(this.horizontalScroll.position, this.verticalScroll.position, this.horizontalScroll.position+this.canvas.width, this.verticalScroll.position+this.canvas.height);

    public draw = () => {
        this.horizontalScroll.draw(this.context, this.verticalScroll.position+this.canvas.height-10);
        this.verticalScroll.draw(this.context, this.horizontalScroll.position+this.canvas.width-10);
    }
}
