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
        region?: ISkyboxRegion,
        verticalTiling?: boolean
    ): void => {
        const r = region ?? this.fullRegion;
        if (r.width <= 0 || r.height <= 0) return;

        // srcX is an offset within the region, wrap it
        const normalizedSrcX = ((srcX % r.width) + r.width) % r.width;

        if (!verticalTiling) {
            // Original behavior: stretch the region vertically to fill destHeight
            this.drawHorizontalStrip(target, r, normalizedSrcX, destX, destY, destWidth, destHeight);
        } else {
            // Vertical tiling: maintain aspect ratio, repeat vertically
            // Compute the tile height that preserves the source region's aspect ratio
            // relative to the destination width. Since the full region width maps to
            // destWidth, the tile height is destWidth * (r.height / r.width).
            const tileHeight = destWidth * (r.height / r.width);
            if (tileHeight <= 0) return;

            let y = destY;
            while (y < destY + destHeight) {
                const rowHeight = Math.min(tileHeight, destY + destHeight - y);
                // If this is a partial row at the bottom, only sample a proportional
                // slice of the source region height
                const srcHeight = (rowHeight / tileHeight) * r.height;
                const partialRegion: ISkyboxRegion = { x: r.x, y: r.y, width: r.width, height: srcHeight };
                this.drawHorizontalStrip(target, partialRegion, normalizedSrcX, destX, y, destWidth, rowHeight);
                y += rowHeight;
            }
        }
    };

    /** Draws a single horizontal strip with seamless horizontal wrapping. */
    private drawHorizontalStrip = (
        target: CanvasRenderingContext2D,
        r: ISkyboxRegion,
        normalizedSrcX: number,
        destX: number,
        destY: number,
        destWidth: number,
        destHeight: number
    ): void => {
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
