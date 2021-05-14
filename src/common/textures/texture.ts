import { WallProps } from '../renderer3d';
import { ITextureSource } from "./model";
import sizeOf from 'image-size';
import * as fs from "fs";
import { distance } from '../geometry/vertex';

export class Texture {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private totalWidth: number;
    private totalHeight: number;
    private columns: number;
    private rows: number;

    constructor(private source: ITextureSource) {

        const imageBuffer = fs.readFileSync(source.path);
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const dimensions = sizeOf(source.path);

        this.canvas = document.createElement('canvas') as HTMLCanvasElement;
        this.canvas.width = this.totalWidth = dimensions.width;
        this.canvas.height = this.totalHeight = dimensions.height;
        this.context = this.canvas.getContext('2d');

        const image = new Image();
        image.onload = () => {
            this.context.drawImage(image, 0, 0);
        };
        image.src = `data:image/png;base64,${base64}`;

        source.textureHeight = source.textureHeight || this.totalHeight;
        source.textureWidth = source.textureWidth || this.totalWidth;

        this.columns = Math.floor(this.totalWidth / source.textureWidth);
        this.rows = Math.floor(this.totalHeight / source.textureHeight);
    }

    get id() { return this.source.path; }
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
        const twidth = this.source.textureWidth;
        const theight = this.source.textureHeight;
        
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
}
