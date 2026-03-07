import { ICamera } from '../camera';
import { IWorldConfigState } from '../store/world-config';
import { Skybox } from './skybox';
import { computeSkyboxOffset } from './skybox-utils';

export class SkyboxRenderer {
    private skybox: Skybox | null = null;
    private skyboxToken: string | null = null;
    private skyboxReady = false;

    public update = (config: IWorldConfigState): void => {
        const source = config.skybox;
        // Token intentionally excludes region — region changes don't require re-loading the image
        const nextToken = source ? `${source.id}:${source.mimeType}:${source.width}x${source.height}:${source.data.length}` : null;
        if (source && nextToken !== this.skyboxToken) {
            this.skybox = new Skybox(source);
            this.skyboxToken = nextToken;
            this.skyboxReady = false;
            const token = nextToken;
            this.skybox.loaded.then(() => {
                if (this.skyboxToken === token) {
                    this.skyboxReady = true;
                }
            });
            return;
        }
        if (!source && this.skyboxToken) {
            this.skybox = null;
            this.skyboxToken = null;
            this.skyboxReady = false;
        }
    };

    public draw = (
        context: CanvasRenderingContext2D,
        camera: ICamera,
        config: IWorldConfigState,
        width: number,
        height: number
    ): boolean => {
        if (!config.skyboxEnabled || !this.skybox || !this.skyboxReady) return false;
        const region = config.skybox?.region;
        const verticalTiling = config.skybox?.verticalTiling;
        const effectiveWidth = region ? region.width : this.skybox.width;
        const halfHeight = height / 2;
        const offset = computeSkyboxOffset(camera, effectiveWidth);
        context.save();
        context.beginPath();
        context.rect(0, 0, width, halfHeight);
        context.clip();
        this.skybox.drawTiled(context, 0, 0, width, halfHeight, offset, region, verticalTiling);
        context.restore();
        return true;
    };
}
