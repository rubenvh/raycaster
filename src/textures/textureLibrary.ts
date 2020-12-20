import { WallProps } from './../renderer3d';
import { ipcRenderer } from "electron";
import { ITextureSource } from "./model";
import sizeOf from 'image-size';
import * as fs from "fs";
import { distance } from '../geometry/vertex';
class Texture {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    
    constructor(private source: ITextureSource) {

        var imageBuffer = fs.readFileSync(source.path);        
        var base64 = Buffer.from(imageBuffer).toString('base64');
        var dimensions = sizeOf(source.path);
        this.canvas = document.createElement('canvas') as HTMLCanvasElement;
        this.canvas.width = dimensions.width; 
        this.canvas.height= dimensions.height;
        this.context = this.canvas.getContext('2d');
        var image = new Image();
        image.onload = () => {
            this.context.drawImage(image, 0, 0);
        };        
        image.src = `data:image/png;base64,${base64}`;
    }

    public drawTexture = (target: CanvasRenderingContext2D, wallProps: WallProps[]) => {
        const tileFactor = 20 // => w.length for stretching
        const twidth = this.source.textureWidth;
        const theight = this.source.textureHeight;
        const textureIndex = 0;    
        for(let windex=wallProps.length-1; windex >= 0;windex--) {
            const w = wallProps[windex];
            const wx = distance(w.origin, w.intersection);
            const [x1, x2] = wallProps[windex].colRange;
            const [y1, y2] = wallProps[windex].rowRange;                
            const tx = Math.floor((twidth * wx / tileFactor) % (twidth - 1));
            target.drawImage(this.canvas, tx+textureIndex*twidth, 0, 1, theight, x1, y1, x2-x1, y2-y1);                
        }     
    }
}
export class TextureLibrary {
    private _sources: ITextureSource[];
    private _textures: Texture[];

    public get textures() { return this._sources; }

    constructor() {
        ipcRenderer.on('importTexture', (_, arg) => this.importTexture(arg.filePaths[0]));
        
        const s = localStorage.getItem('textureSources');       
        this._sources = JSON.parse(s || '[]');
        this._textures = this._sources.map(x => new Texture(x));
    }

    private importTexture = (path: string) => {    
        fs.readFile(path, (err, data) => {
            // TODO: error handling

            if (!this._sources.some(t => t.path === path)) {

                var s: ITextureSource = {path, textureHeight: 0, textureWidth: 0};
                var t = new Texture(s);
                this._sources.push(s);
                this._textures.push(t);
                localStorage.setItem('textureSources', JSON.stringify(this._sources))
            }
        });  
    };

    public drawTexture = (target: CanvasRenderingContext2D, wallProps: WallProps[]) => {
        // TODO: wallProps[0].material.texture
        this._textures[0].drawTexture(target, wallProps);
    }
}