export class ScrollBar {

    private pos: number = 0;
    private bound: number = 0;
    private barOffset: number = 0;
    private barSize: number = 0;

    constructor(private isHorizontal: boolean, private viewSize: number, private size: number = viewSize) {
    }

    public setBoundary = (bound: number) => {
        this.bound = bound;
        this.recalculate();
    };
    public get position() { return this.pos; }
    public scroll(value: number) { this.pos += value; this.recalculate(); }
    public reset() { this.pos = 0; this.recalculate(); }
    public resize(viewSize: number, size = viewSize) {
        this.viewSize = viewSize;
        this.size = size;
        this.recalculate();
    }

    public draw = (context: CanvasRenderingContext2D, location: number) => {
        // don't draw when everything in view
        if (this.barSize === this.size) { return; }

        context.fillStyle = "rgba(0,0,0,0.7)";
        if (this.isHorizontal) {
            context.fillRect(this.pos + this.barOffset, location, this.barSize, 5);
        } else {
            context.fillRect(location, this.pos + this.barOffset, 5, this.barSize);
        }
    };

    private recalculate = () => {
        const max = Math.max(this.bound, this.pos + this.viewSize);
        const p = this.viewSize / max;
        this.barSize = p * this.size;
        this.barOffset = this.pos / max * this.size;
    };
}
