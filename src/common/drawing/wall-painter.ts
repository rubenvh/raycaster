import { Guid } from "guid-typescript";
import { lookupMaterialFor, RayHit } from "../geometry/collision";
import { cloneKey, IEntityKey } from "../geometry/entity";
import { computeEdgeLuminosity } from "../geometry/edge";
import { IMaterial, isTranslucent } from "../geometry/properties";
import { distance as vertexDistance } from "../geometry/vertex";
import { Vector } from "../math/vector";
import { connect } from "../store/store-connector";
import { getSunDirection, IWorldConfigState } from "../store/world-config";
import { Texture } from "../textures/texture";
import { textureLib, TextureLibrary } from "../textures/textureLibrary";
import { drawTrapezoid } from "./drawing";

export type WallProps = {
    edgeId: IEntityKey,
    height: number,
    edgeLuminosity: number,
    material: IMaterial,
    intersection: Vector,
    origin: Vector,
    length: number,
    rowRange: [number, number],
    colRange: [number, number],
    distance: number,
    /** Pre-computed distance from edge origin to intersection point along the edge.
     *  Used for texture X coordinate lookup, avoiding redundant sqrt during drawing. */
    textureDistance: number,
};

// Pre-computed fade alpha CSS strings: 101 entries for alpha 0.00 to 1.00.
// Built lazily per shade value since shade comes from world config and rarely changes.
let _fadeCacheShade: number | null = null;
let _fadeAlphaStrings: string[] = [];

function getFadeString(shade: number, alpha: number): string {
    if (_fadeCacheShade !== shade) {
        _fadeCacheShade = shade;
        _fadeAlphaStrings = new Array(101);
        for (let i = 0; i <= 100; i++) {
            _fadeAlphaStrings[i] = `rgba(${shade},${shade},${shade},${(i / 100).toFixed(2)})`;
        }
    }
    // Quantize alpha to nearest 0.01
    const index = Math.min(100, Math.max(0, Math.round(alpha * 100)));
    return _fadeAlphaStrings[index];
}

// Pre-computed luminosity overlay strings for texture darkening: "rgba(0,0,0,{alpha})"
// 101 entries for alpha 0.00 to 1.00
const _luminosityOverlayStrings: string[] = new Array(101);
for (let i = 0; i <= 100; i++) {
    _luminosityOverlayStrings[i] = `rgba(0,0,0,${(i / 100).toFixed(2)})`;
}

function getLuminosityOverlay(alpha: number): string {
    const index = Math.min(100, Math.max(0, Math.round(alpha * 100)));
    return _luminosityOverlayStrings[index];
}

export class WallPainter {
    private textureLibrary: TextureLibrary = textureLib;
    private worldConfig: IWorldConfigState = { sunAngle: Math.PI / 2 };
    private sunDirection: Vector = getSunDirection(Math.PI / 2);
    
    constructor(private context: CanvasRenderingContext2D, private resolution: number, private height: number, private width: number) {
        connect(s => {            
            this.worldConfig = s.worldConfig;
            this.sunDirection = getSunDirection(s.worldConfig.sunAngle);
        });
    }


    private mapToColumn = (column: number) => Math.floor(this.width - column * this.width / this.resolution);

    public createWall = (hit: RayHit, rayIndex: number, origin: Vector = null): WallProps => {
        const height = this.convertDistanceToWallHeight(hit.distance);
        const startRow = Math.floor((this.height - height) / 2);
        const endRow = Math.floor((this.height + height) / 2);
        const edgeId = hit.edge && hit.edge.id || Guid.EMPTY;
        const wallOrigin = origin ?? hit.edge?.start.vector;
        const intersectionPoint = hit.intersection?.point;
        return ({
            edgeId, height,
            edgeLuminosity: hit.edge ? computeEdgeLuminosity(hit.edge.segment, this.sunDirection) : 0,
            material: lookupMaterialFor(hit.intersection, hit.edge),
            rowRange: [startRow, endRow],
            colRange: [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex +1)],
            intersection: intersectionPoint,
            origin: wallOrigin,
            distance: hit.distance,
            length: hit.edge?.length,
            textureDistance: (wallOrigin && intersectionPoint) ? vertexDistance(wallOrigin, intersectionPoint) : 0,
        });
    };    

    
    
    private convertDistanceToWallHeight = (d: number) => Math.round(10 * this.height / d);
    
    public drawWall = (wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length - 1];
        const end = wallProps[0];
        // don't draw invisible walls      
        if (start.height <= 0) return;
        if (start.material?.color[3] === 0) return;
    
        const texture = this.textureLibrary.lookupTexture(start.material);
        if (!texture) {
            drawTrapezoid(this.context, this.getTrapezoid(start, end), this.getColor(start.material, this.getLumen(start)));
        } else {
            this.drawTexture(this.context, texture, wallProps);
        }
    
        // apply fading    
        if (this.worldConfig.fadeOn != null) {
            this.applyFading(this.context, wallProps);
        }
    };

    private drawTexture = (context: CanvasRenderingContext2D, texture: Texture, wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length - 1];
        const end = wallProps[0];

        // Apply material's alpha/translucency to texture
        const alpha = start.material?.color[3] ?? 1;
        context.globalAlpha = alpha;

        // draw texture
        texture.drawTexture(context, wallProps);
        // apply luminosity to texture (uses pre-computed string to avoid template literal per wall)
        drawTrapezoid(context, this.getTrapezoid(start, end), getLuminosityOverlay(1 - this.getLumen(start)));

        // Restore globalAlpha to default
        context.globalAlpha = 1;
    }

    private applyFading = (context: CanvasRenderingContext2D, wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length - 1];
        const end = wallProps[0];
        const trapezoid = this.getTrapezoid(start, end);
        const shade = this.worldConfig.fadeOn;
        let color: string | CanvasGradient;

        if (start.material.luminosity != null) {
            // luminosity is overridden on the wall's material definition (uses pre-computed string)
            color = getFadeString(shade, 1 - start.material.luminosity);
        } else {
            // automatically decide fading amount based on the wall's distance to the camera
            const horizonDistance = this.worldConfig.horizonDistance ?? 300;
            const addGradient = (step: number, w: WallProps, gradient: CanvasGradient): CanvasGradient => {
                const fadeFactor = Math.min(horizonDistance, w.distance) / (horizonDistance + 10);
                gradient.addColorStop(step, getFadeString(shade, fadeFactor));
                return gradient;
            }
            color = addGradient(1, end,
                addGradient(0, start,
                    context.createLinearGradient(trapezoid[0][0], 0, trapezoid[3][0], 0)))
        }
        drawTrapezoid(context, trapezoid, color);
    }


    // Pre-allocated scratch trapezoid to avoid 5 array allocations per call.
    // Safe because caller consumes the trapezoid immediately before next getTrapezoid call.
    private _trapezoid: [Vector, Vector, Vector, Vector] = [[0,0],[0,0],[0,0],[0,0]];

    private getTrapezoid = (start: WallProps, end: WallProps): [Vector, Vector, Vector, Vector] => {
        this._trapezoid[0][0] = start.colRange[1]; this._trapezoid[0][1] = start.rowRange[0] - 0.5;
        this._trapezoid[1][0] = start.colRange[1]; this._trapezoid[1][1] = start.rowRange[1] + 0.5;
        this._trapezoid[2][0] = end.colRange[0];   this._trapezoid[2][1] = end.rowRange[1] + 0.5;
        this._trapezoid[3][0] = end.colRange[0];   this._trapezoid[3][1] = end.rowRange[0] - 0.5;
        return this._trapezoid;
    };
    
    private getColor = (material: IMaterial, lumen: number): string => {
        if (material?.color) {
            const color = material.color;
            return `rgba(${color[0] * lumen},${color[1] * lumen},${color[2] * lumen},${color[3]})`;
        }
        return `rgb(0,0,${lumen * 155 + 100})`;
    };
    
    private getLumen = (wall: WallProps) => wall.material?.luminosity || wall.edgeLuminosity;
}