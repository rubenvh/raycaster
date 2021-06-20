import { maximumComponents, Vector } from "../math/vector";

export class Scrollifier {
    
    private scrollPos = [0,0];
    private SCROLL_SIZE: number = 40;
    private context: CanvasRenderingContext2D;
    bounds: Vector;

    get scrollX() {
        return this.scrollPos[0];
    }
    get scrollY() {
        return this.scrollPos[1];
    }
    
    
    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.canvas.addEventListener('wheel', (ev: WheelEvent) => {
            ev.preventDefault();   

            const sign = ev.deltaY<0?-1:1;            
            const [deltaX, deltaY] = ev.shiftKey ? [this.SCROLL_SIZE*sign, 0] : [0, this.SCROLL_SIZE*sign];
            if ((this.scrollPos[0]+deltaX < 0) ||  this.scrollPos[1]+deltaY < 0) {
                return;
            }

            this.scrollPos = [this.scrollPos[0]+deltaX, this.scrollPos[1]+deltaY];            
            this.context.setTransform(
                1, 0,
                0, 1,
                -1 * this.scrollPos[0], 
                -1 * this.scrollPos[1]);
        });
    }

    public setBounds = (bounds: Vector) => {
        this.bounds = bounds;
    }
    public reset = () => this.scrollPos = [0,0];
    public clearView = () => this.context.clearRect(this.scrollPos[0], this.scrollPos[1], this.scrollPos[0]+this.canvas.width, this.scrollPos[1]+this.canvas.height);

    public draw = () => {
        if (this.bounds) {
            this.calc();
        }
        
    }

    

    private calc =() => {

        // TODO: split horizontal/vertical calculation into something generic
        // TODO: only recalc when scroll pos changes or bounds change
        const [w, h] = [this.canvas.width, this.canvas.height];
        const [sx, sy] = this.scrollPos;
        const [max_x, max_y] = maximumComponents(this.bounds, [sx + w, sy + h]);

        const [hor_p, ver_p] = [w / max_x, h / max_y];

        const [hor_bar, ver_bar] = [hor_p * w, ver_p * h];
        const [hor_pos, ver_pos] = [(sx) / max_x, (sy) / max_y];

        // TODO: execute drawing inside draw function (+ style it)
        // TODO: make sure horizontal does not overlap vertical at the end of scroll view
        this.context.fillRect(sx+w*hor_pos,sy+h-10,hor_bar,5);
        this.context.fillRect(sx+w-10, sy+h*ver_pos, 5, ver_bar);


    }
    
};

class ScrollBar {

    private pos: number;
    private bound: number;
    constructor(private isHorizontal: boolean, private viewSize: number, private size: number) {
        this.pos = 0;
    }

    public setBoundary = (bound: number) => {
        this.bound = bound;
    }

    public draw = (context: CanvasRenderingContext2D, location: number)  => {
        const max = Math.max(this.bound, this.pos + this.viewSize);
        const p = this.viewSize / max;
        const barSize = p * this.size;
        const barOffset = this.pos / max * this.size;

        if (this.isHorizontal) {
            context.fillRect(this.pos+barOffset, location,barSize,5);
        } else {
            context.fillRect(location, this.pos+barOffset, 5, barSize);
        }        
    }

}