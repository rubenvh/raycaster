/**
 * Floor and ceiling renderer for the ZBuffer pipeline.
 * 
 * Uses per-pixel floor casting: for each screen pixel below the wall bottom (floor)
 * or above the wall top (ceiling), projects the pixel back to world-space coordinates,
 * looks up which polygon contains that point using a grid spatial index, and draws
 * with the polygon's floor/ceiling material.
 * 
 * Floor/ceiling pixel projection math:
 * - Wall height formula: wallHeight = 10 * screenHeight / perpDistance
 * - Wall bottom row: screenHeight/2 + wallHeight/2
 * - For a floor pixel at row y (below screen center):
 *     rowOffset = y - screenHeight/2
 *     perpDistance = 5 * screenHeight / rowOffset
 *     actualDistance = perpDistance / ray.cosAngle
 *     worldPoint = cameraPos + ray.dn * actualDistance
 * - Ceiling uses the same formula but mirrored above screen center
 */
import { ICamera } from '../../camera';
import { IRay } from '../../geometry/collision';
import { IMaterial } from '../../geometry/properties';
import { IPolygon } from '../../geometry/polygon';
import { IPolygonGrid, buildPolygonGrid } from '../../geometry/polygon-grid';
import { IWorldConfigState, DEFAULT_FLOOR_MATERIAL } from '../../store/world-config';
import { Vector } from '../../math/vector';

/**
 * Per-column wall boundary info needed for floor/ceiling rendering.
 * Describes where the nearest wall starts and ends on screen.
 */
export interface IColumnWallBounds {
    /** Row where the nearest wall's top starts (above this is sky/ceiling territory) */
    wallTop: number;
    /** Row where the nearest wall's bottom ends (below this is floor territory) */
    wallBottom: number;
    /** Whether this column has any wall at all */
    hasWall: boolean;
}

/**
 * Configuration for the floor/ceiling renderer.
 */
export interface IFloorRendererConfig {
    screenWidth: number;
    screenHeight: number;
    /** The half-height constant used in the wall height formula: wallHeight = heightConstant * screenHeight / distance.
     *  For the standard formula wallHeight = 10 * screenHeight / distance, heightConstant = 10 and half = 5. */
    halfHeightConstant: number;
}

/**
 * Render polygon floors and ceilings for the visible columns.
 * 
 * Call this AFTER the ZBuffer is populated (so wall bounds are known)
 * but BEFORE walls are drawn (so floors appear behind walls).
 * 
 * @param context - Canvas 2D rendering context
 * @param camera - Current camera
 * @param rays - Pre-computed camera rays (one per column)
 * @param columnBounds - Per-column wall boundary data from ZBuffer
 * @param grid - Spatial index of visible polygons
 * @param config - Screen dimensions and constants
 * @param worldConfig - World configuration (for default floor material and fading)
 */
export function renderFloors(
    context: CanvasRenderingContext2D,
    camera: ICamera,
    rays: IRay[],
    columnBounds: IColumnWallBounds[],
    grid: IPolygonGrid,
    config: IFloorRendererConfig,
    worldConfig: IWorldConfigState,
): void {
    const { screenWidth, screenHeight, halfHeightConstant } = config;
    const halfScreen = screenHeight / 2;
    const camX = camera.position[0];
    const camY = camera.position[1];
    const defaultFloor = worldConfig.floorMaterial ?? DEFAULT_FLOOR_MATERIAL;

    // Use ImageData for efficient per-pixel floor/ceiling rendering.
    // Reading existing pixels lets us only overwrite where polygon materials differ from default.
    const imageData = context.getImageData(0, 0, screenWidth, screenHeight);
    const pixels = imageData.data;

    let anyPixelDrawn = false;

    for (let col = 0; col < screenWidth; col++) {
        const ray = rays[col];
        if (!ray) continue;

        const bounds = columnBounds[col];

        // Floor rendering: from wall bottom (or screen center if no wall) to screen bottom
        const floorStart = bounds.hasWall
            ? Math.max(Math.ceil(halfScreen), bounds.wallBottom)
            : Math.ceil(halfScreen);
        
        renderFloorColumn(
            pixels, screenWidth, col,
            floorStart, screenHeight,
            halfScreen, halfHeightConstant,
            camX, camY, ray,
            grid, defaultFloor,
            /* isCeiling */ false,
        );

        // Ceiling rendering: from screen top to wall top (or screen center if no wall)
        const ceilingEnd = bounds.hasWall
            ? Math.min(Math.floor(halfScreen), bounds.wallTop)
            : Math.floor(halfScreen);
        
        if (ceilingEnd > 0) {
            renderCeilingColumn(
                pixels, screenWidth, col,
                0, ceilingEnd,
                halfScreen, halfHeightConstant,
                camX, camY, ray,
                grid,
            );
        }

        anyPixelDrawn = true;
    }

    if (anyPixelDrawn) {
        context.putImageData(imageData, 0, 0);
    }
}

/**
 * Render floor pixels for a single column.
 */
function renderFloorColumn(
    pixels: Uint8ClampedArray,
    screenWidth: number,
    col: number,
    startRow: number,
    endRow: number,
    halfScreen: number,
    halfHeightConstant: number,
    camX: number,
    camY: number,
    ray: IRay,
    grid: IPolygonGrid,
    defaultFloor: IMaterial,
    isCeiling: boolean,
): void {
    const dnX = ray.dn[0];
    const dnY = ray.dn[1];
    const invCos = 1 / ray.cosAngle;

    for (let row = startRow; row < endRow; row++) {
        const rowOffset = row - halfScreen;
        if (rowOffset <= 0) continue; // Skip at or above horizon

        // Perpendicular distance for this floor row
        const perpDist = halfHeightConstant * halfScreen * 2 / rowOffset;
        // Actual distance along the ray
        const actualDist = perpDist * invCos;

        // World-space coordinate
        const worldX = camX + dnX * actualDist;
        const worldY = camY + dnY * actualDist;

        // Look up polygon
        const polygon = grid.lookup([worldX, worldY]);
        const material = polygon?.floorMaterial ?? defaultFloor;

        if (material) {
            const pixelIndex = (row * screenWidth + col) * 4;
            const c = material.color;
            // Apply distance-based darkening for floor (simple linear falloff)
            const lumen = Math.max(0.15, 1 - actualDist / 600);
            pixels[pixelIndex]     = c[0] * lumen;
            pixels[pixelIndex + 1] = c[1] * lumen;
            pixels[pixelIndex + 2] = c[2] * lumen;
            pixels[pixelIndex + 3] = c[3] * 255;
        }
    }
}

/**
 * Render ceiling pixels for a single column.
 * Only polygons with explicit ceilingMaterial get a ceiling; sky is default.
 */
function renderCeilingColumn(
    pixels: Uint8ClampedArray,
    screenWidth: number,
    col: number,
    startRow: number,
    endRow: number,
    halfScreen: number,
    halfHeightConstant: number,
    camX: number,
    camY: number,
    ray: IRay,
    grid: IPolygonGrid,
): void {
    const dnX = ray.dn[0];
    const dnY = ray.dn[1];
    const invCos = 1 / ray.cosAngle;

    for (let row = startRow; row < endRow; row++) {
        const rowOffset = halfScreen - row;
        if (rowOffset <= 0) continue; // Skip at or below horizon

        // Perpendicular distance for this ceiling row (same formula, mirrored)
        const perpDist = halfHeightConstant * halfScreen * 2 / rowOffset;
        const actualDist = perpDist * invCos;

        // World-space coordinate
        const worldX = camX + dnX * actualDist;
        const worldY = camY + dnY * actualDist;

        // Look up polygon — only render ceiling if polygon has explicit ceilingMaterial
        const polygon = grid.lookup([worldX, worldY]);
        if (!polygon?.ceilingMaterial) continue; // Sky by default

        const material = polygon.ceilingMaterial;
        const pixelIndex = (row * screenWidth + col) * 4;
        const c = material.color;
        // Apply distance-based darkening
        const lumen = Math.max(0.15, 1 - actualDist / 600);
        pixels[pixelIndex]     = c[0] * lumen;
        pixels[pixelIndex + 1] = c[1] * lumen;
        pixels[pixelIndex + 2] = c[2] * lumen;
        pixels[pixelIndex + 3] = c[3] * 255;
    }
}

/**
 * Build the column wall bounds array from ZBuffer column data.
 * This should be called after the ZBuffer is populated but before walls are rendered.
 * 
 * @param getNearestWallBounds - Function that returns the nearest wall's row range for a column
 * @param columnCount - Number of columns
 * @param screenHeight - Screen height for default bounds
 */
export function buildColumnBounds(
    getNearestWallBounds: (col: number) => [number, number] | null,
    columnCount: number,
    screenHeight: number,
): IColumnWallBounds[] {
    const halfScreen = screenHeight / 2;
    const bounds: IColumnWallBounds[] = new Array(columnCount);
    for (let i = 0; i < columnCount; i++) {
        const wallRange = getNearestWallBounds(i);
        if (wallRange) {
            bounds[i] = {
                wallTop: wallRange[0],
                wallBottom: wallRange[1],
                hasWall: true,
            };
        } else {
            bounds[i] = {
                wallTop: halfScreen,
                wallBottom: halfScreen,
                hasWall: false,
            };
        }
    }
    return bounds;
}
