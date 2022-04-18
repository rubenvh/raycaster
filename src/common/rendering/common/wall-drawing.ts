import { drawTrapezoid } from "../../drawing/drawing";
import { IEntityKey } from "../../geometry/entity";
import { IMaterial } from "../../geometry/properties";
import { Vector } from "../../math/vector";

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

export const convertDistanceToWallHeight = (d: number, height: number) => Math.round(10 * height / d);

export const drawWall = (context: CanvasRenderingContext2D, wallProps: WallProps[]) => {
    const start = wallProps[wallProps.length - 1];
    const end = wallProps[0];
    // don't draw invisible walls      
    if (start.height <= 0) return;
    if (start.material?.color[3] === 0) return;

    const texture = null; //this.textureLibrary.lookupTexture(start.material);
    if (!texture) {
        drawTrapezoid(context, getTrapezoid(start, end), getColor(start.material, getLumen(start)));
    } else {
    //    drawTexture(texture, wallProps);
    }

    // apply fading    
    // if (this.worldConfig.fadeOn != null) {
    //     this.applyFading(wallProps);
    // }
};
const getTrapezoid = (start: WallProps, end: WallProps): [Vector, Vector, Vector, Vector] => ([
    [start.colRange[1], start.rowRange[0] - 0.5],
    [start.colRange[1], start.rowRange[1] + 0.5],
    [end.colRange[0], end.rowRange[1] + 0.5],
    [end.colRange[0], end.rowRange[0] - 0.5]]);

const getColor = (material: IMaterial, lumen: number): string => {
    if (material?.color) {
        const color = material.color;
        return `rgba(${color[0] * lumen},${color[1] * lumen},${color[2] * lumen},${color[3]})`;
    }
    return `rgb(0,0,${lumen * 155 + 100})`;
};

const getLumen = (wall: WallProps) => wall.material?.luminosity || wall.edgeLuminosity;