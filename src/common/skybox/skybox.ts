import { ISkyboxRegion, ISkyboxSource } from './model';

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

    /** Returns the full-image region. */
    get fullRegion(): ISkyboxRegion {
        return { x: 0, y: 0, width: this._source.width, height: this._source.height };
    }

    public drawTiled = (
        target: CanvasRenderingContext2D,
        destX: number,
        destY: number,
        destWidth: number,
        destHeight: number,
        srcX: number,
        region?: ISkyboxRegion
    ): void => {
        const r = region ?? this.fullRegion;
        if (r.width <= 0 || r.height <= 0) return;

        // srcX is an offset within the region, wrap it
        const normalizedSrcX = ((srcX % r.width) + r.width) % r.width;
        const firstWidth = Math.min(destWidth, r.width - normalizedSrcX);
        target.drawImage(
            this.canvas,
            r.x + normalizedSrcX,
            r.y,
            firstWidth,
            r.height,
            destX,
            destY,
            firstWidth,
            destHeight
        );
        const remaining = destWidth - firstWidth;
        if (remaining > 0) {
            target.drawImage(
                this.canvas,
                r.x,
                r.y,
                remaining,
                r.height,
                destX + firstWidth,
                destY,
                remaining,
                destHeight
            );
        }
    };
}
