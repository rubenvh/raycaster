import { Colors } from "./colors";

export class Grid {

    private GRID_SIZE: number = 20;    
    private gridContext: CanvasRenderingContext2D;    
    private grid: HTMLCanvasElement;
    
    constructor(private targetContext: CanvasRenderingContext2D, width: number, height: number) {                
        this.grid = document.createElement('canvas') as HTMLCanvasElement;        
        this.gridContext = this.grid.getContext('2d');
        this.adaptGrid(width, height);
    }
    public adaptGrid = (width: number, height: number) => {      
        if (width > this.grid.width || height > this.grid.height){
            console.log('adaptGrid', width, height);
            this.grid.width = width;
            this.grid.height = height;                
            this.gridContext.beginPath();
            this.gridContext.lineWidth = 1;
            this.gridContext.setLineDash([4, 2]);
            this.gridContext.strokeStyle = Colors.BLACK;
            for (let x = 0; x <= width; x += this.GRID_SIZE) {
                this.gridContext.moveTo(x, 0);
                this.gridContext.lineTo(x, height);
                for (let y = 0; y <= height; y += this.GRID_SIZE) {
                    this.gridContext.moveTo(0, y);
                    this.gridContext.lineTo(width, y);
                }
            }
            this.gridContext.stroke();
        }        
    };

    public draw = (x: number, y: number, w: number, h: number) => this.targetContext.drawImage(this.grid, x, y, w, h, x, y, w, h);
}