import { Guid } from "guid-typescript";
import { lookupMaterialFor, RayHit } from "../geometry/collision";
import { cloneKey, IEntityKey } from "../geometry/entity";
import { IMaterial, isTranslucent } from "../geometry/properties";
import { Vector } from "../math/vector";
import { connect } from "../store/store-connector";
import { IWorldConfigState } from "../store/world-config";
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
};

export class WallPainter {
    private textureLibrary: TextureLibrary = textureLib;
    private worldConfig: IWorldConfigState = {};
    
    constructor(private context: CanvasRenderingContext2D, private resolution: number, private height: number, private width: number) {
        connect(s => {            
            this.worldConfig = s.worldConfig;            
        });
    }


    private mapToColumn = (column: number) => Math.floor(this.width - column * this.width / this.resolution);

    public createWall = (hit: RayHit, rayIndex: number, origin: Vector = null): WallProps => {
        const height = this.convertDistanceToWallHeight(hit.distance);
        const startRow = Math.floor((this.height - height) / 2);
        const endRow = Math.floor((this.height + height) / 2);
        const edgeId = hit.edge && hit.edge.id || Guid.EMPTY;
        return ({
            edgeId: cloneKey(edgeId), height,
            edgeLuminosity: hit.edge?.luminosity || 0,
            material: lookupMaterialFor(hit.intersection, hit.edge),
            rowRange: [startRow, endRow],
            colRange: [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex +1)],
            intersection: hit.intersection?.point,
            origin: origin ?? hit.edge?.start.vector,
            distance: hit.distance,
            length: hit.edge?.length,
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

        // draw texture
        texture.drawTexture(context, wallProps);
        // apply luminosity to texture
        drawTrapezoid(context, this.getTrapezoid(start, end), `rgba(0,0,0,${1 - this.getLumen(start)}`);
    }

    private applyFading = (context: CanvasRenderingContext2D, wallProps: WallProps[]) => {
        const start = wallProps[wallProps.length - 1];
        const end = wallProps[0];
        const trapezoid = this.getTrapezoid(start, end);
        const shade = this.worldConfig.fadeOn;
        let color: string | CanvasGradient;

        if (start.material.luminosity != null) {
            // luminosity is overidden on the wall's material definition:            
            color = `rgba(${shade},${shade},${shade},${(1 - start.material.luminosity).toFixed(2)})`;
        } else {
            // automatically decide fading amount based on the wall's distance to the camera
            const horizonDistance = this.worldConfig.horizonDistance ?? 300;
            const addGradient = (step: number, w: WallProps, gradient: CanvasGradient): CanvasGradient => {
                const fadeFactor = Math.min(horizonDistance, w.distance) / (horizonDistance + 10);
                const fadeColor = `rgba(${shade},${shade},${shade},${fadeFactor.toFixed(2)})`;
                gradient.addColorStop(step, fadeColor);
                return gradient;
            }
            color = addGradient(1, end,
                addGradient(0, start,
                    context.createLinearGradient(trapezoid[0][0], 0, trapezoid[3][0], 0)))
        }
        drawTrapezoid(context, trapezoid, color);
    }


    private getTrapezoid = (start: WallProps, end: WallProps): [Vector, Vector, Vector, Vector] => ([
        [start.colRange[1], start.rowRange[0] - 0.5],
        [start.colRange[1], start.rowRange[1] + 0.5],
        [end.colRange[0], end.rowRange[1] + 0.5],
        [end.colRange[0], end.rowRange[0] - 0.5]]);
    
    private getColor = (material: IMaterial, lumen: number): string => {
        if (material?.color) {
            const color = material.color;
            return `rgba(${color[0] * lumen},${color[1] * lumen},${color[2] * lumen},${color[3]})`;
        }
        return `rgb(0,0,${lumen * 155 + 100})`;
    };
    
    private getLumen = (wall: WallProps) => wall.material?.luminosity || wall.edgeLuminosity;
}