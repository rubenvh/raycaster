import { ISkyboxSource } from './model';

export class Skybox {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private _loaded: Promise<void>;
    private _source: ISkyboxSource;

    get loaded(): Promise<void> { return this._loaded; }
    get width(): number { return this._source.width; }
    get height(): number { return this._source.height; }

    constructor(source: ISkyboxSource) {
        this._source = { ...source };
        this.canvas = document.createElement('canvas') as HTMLCanvasElement;
        this.canvas.width = this._source.width;
        this.canvas.height = this._source.height;
        this.context = this.canvas.getContext('2d');

        this._loaded = new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => {
                this.context.drawImage(image, 0, 0);
                resolve();
            };
            image.src = `data:${this._source.mimeType};base64,${this._source.data}`;
        });
    }

    public drawTiled = (
        target: CanvasRenderingContext2D,
        destX: number,
        destY: number,
        destWidth: number,
        destHeight: number,
        srcX: number
    ): void => {
        if (this._source.width <= 0 || this._source.height <= 0) return;
        const normalizedSrcX = ((srcX % this._source.width) + this._source.width) % this._source.width;
        const firstWidth = Math.min(destWidth, this._source.width - normalizedSrcX);
        target.drawImage(
            this.canvas,
            normalizedSrcX,
            0,
            firstWidth,
            this._source.height,
            destX,
            destY,
            firstWidth,
            destHeight
        );
        const remaining = destWidth - firstWidth;
        if (remaining > 0) {
            target.drawImage(
                this.canvas,
                0,
                0,
                remaining,
                this._source.height,
                destX + firstWidth,
                destY,
                remaining,
                destHeight
            );
        }
    };
}
