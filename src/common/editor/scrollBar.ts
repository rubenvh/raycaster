export class ScrollBar {

    private pos: number = 0;
    private bound: number = 0;
    private barOffset: number = 0;
    private barSize: number = 0;
    scale: number;

    constructor(private isHorizontal: boolean, private viewSize: number, private size: number = viewSize) {
    }

    public setBoundary = (bound: number) => {
        this.bound = bound;
        this.recalculate();
    };
    public get position() { return this.pos; }
    public scroll(value: number) {                 
        this.pos = Math.max(0, this.pos + value);
        this.recalculate(); 
    }
    public scrollTo(target: number) { this.pos = target; this.recalculate(); }
    public reset() { this.pos = 0; this.recalculate(); }
    public resize(viewSize: number, size = viewSize, scale = 1) {
        this.viewSize = viewSize;
        this.size = size;
        this.scale = scale;
        this.recalculate();
    }

    public draw = (context: CanvasRenderingContext2D, location: number, scale: number) => {
        // don't draw when everything in view
        if (this.barSize === this.size) { return; }

        context.fillStyle = "rgba(125,125,125,0.7)";
        if (this.isHorizontal) { 
            context.fillRect(this.pos/scale, location/scale, this.size/scale, 5/scale);
        } else {
            context.fillRect(location/scale, this.pos/scale, 5/scale, this.size/scale);
        }

        context.fillStyle = "rgba(0,0,0,0.9)";
        if (this.isHorizontal) {            
            context.fillRect((this.pos + this.barOffset)/scale, location/scale, this.barSize/scale, 5/scale);
        } else {            
            context.fillRect(location/scale, (this.pos + this.barOffset)/scale, 5/scale, this.barSize/scale);            
        }
    };

    private recalculate = () => {
        const pos = this.pos/this.scale;
        const max = Math.max(this.bound, pos + this.viewSize);
        const p = this.viewSize / max;
        this.barSize = p * this.size;
        this.barOffset = pos / max * this.size;        
    };
}
