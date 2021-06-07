import { WallProps } from '../renderer3d';
import { ITextureReference, ITextureSource } from "./model";

import { distance } from '../geometry/vertex';

export class Texture {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private totalWidth: number;
    private totalHeight: number;
    private columns: number;
    private rows: number;
    private _source: ITextureSource
    constructor(source: ITextureSource) {
       
        this._source = {...source};
        this.canvas = document.createElement('canvas') as HTMLCanvasElement;
        this.canvas.width = this.totalWidth = this._source.totalWidth;
        this.canvas.height = this.totalHeight = this._source.totalHeight;
        this.context = this.canvas.getContext('2d');

        const image = new Image();
        image.onload = () => {
            this.context.drawImage(image, 0, 0);
        };
        image.src = `data:image/png;base64,${source.data}`;

        this._source.textureHeight = this._source.textureHeight || this._source.totalHeight;
        this._source.textureWidth = this._source.textureWidth || this._source.totalWidth;

        this.columns = Math.floor(this.totalWidth / this._source.textureWidth);
        this.rows = Math.floor(this.totalHeight / this._source.textureHeight);
    }

    get id() { return this._source.id; }
    get parts() { return this.columns * this.rows; }
    public getPosition = (index: number): [number, number] => {        
        return [
            index % this.columns,
            Math.floor(index / this.columns)
        ];
    };

    public drawTexture = (target: CanvasRenderingContext2D, wallProps: WallProps[]) => {
        const tref = wallProps[0].material?.texture;
        const [col, row] = this.getPosition(tref != null ? tref.index : 0);
        
        const tileFactor = 20; // => w.length for stretching
        const twidth = this._source.textureWidth;
        const theight = this._source.textureHeight;
        
        for (let windex = wallProps.length - 1; windex >= 0; windex--) {
            const w = wallProps[windex];
            const wx = distance(w.origin, w.intersection);
            const [x2, x1] = w.colRange;
            const [y1, y2] = w.rowRange;
            const targetWidth = x2-x1;
            const targetHeight = y2-y1;
            const tx = Math.floor((twidth * wx / tileFactor) % (twidth - 1));
            target.drawImage(this.canvas, tx + col * twidth, row * theight, 1, theight, x1, y1, targetWidth, targetHeight);                        
        }
    };

    public getTextureAsImage = (tref: ITextureReference): string => {
        const [col, row] = this.getPosition(tref != null ? tref.index : 0);
        const canvas = document.createElement('canvas') as HTMLCanvasElement;
        const twidth = this._source.textureWidth;
        const theight = this._source.textureHeight;
        canvas.width = twidth;
        canvas.height = theight;
        const context = this.canvas.getContext('2d');
        
        // context.drawImage(this.canvas, );
        let data =  this.context.getImageData(col*twidth, col*theight, col*twidth+twidth,col*theight + theight);

    }
}
