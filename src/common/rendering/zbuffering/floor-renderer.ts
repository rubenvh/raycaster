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
 * 
 * Performance optimizations:
 * - Row-major iteration: pixel writes are sequential in memory (cache-friendly).
 * - Per-row perpDist: computed once per row, shared across all columns.
 * - Offscreen canvas compositing: avoids getImageData() on the main canvas, which
 *   would force a GPU→CPU sync and permanently de-optimize the canvas to software mode.
 * - Polygon-only rendering: pixels outside polygon boundaries are skipped entirely.
 *   The background floor from drawFloor() is already correct for these pixels.
 * - Reusable typed arrays and ImageData: cached at module level to avoid per-frame allocation.
 * - Row-level skip: entire rows are skipped when their world-space projection range
 *   is disjoint with the polygon grid's bounding box.
 * - Column-range narrowing: per row, binary search finds the first/last columns
 *   whose world coordinates fall within grid bounds, skipping ~60-80% of columns.
 * - Dirty-rect canvas: only the pixel region that was actually written is composited,
 *   avoiding full-screen putImageData/drawImage on sparse scenes.
 */
import { ICamera } from '../../camera';
import { IRay } from '../../geometry/collision';
import { IMaterial } from '../../geometry/properties';
import { IPolygon } from '../../geometry/polygon';
import { IPolygonGrid } from '../../geometry/polygon-grid';
import { IWorldConfigState, DEFAULT_FLOOR_MATERIAL } from '../../store/world-config';

/**
 * Texture provider interface for floor/ceiling rendering.
 * Structurally compatible with TextureLibrary from the textures module.
 */
export interface ITextureProvider {
    lookupTexture(material: IMaterial): {
        getSubTexturePixels(index: number): { data: Uint8ClampedArray, width: number, height: number } | null;
    } | null;
}

/** World units per texture tile repeat. Matches wall tileFactor in texture.ts */
const TILE_FACTOR = 20;

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

// --- Module-level cached resources (reused across frames) ---

// Offscreen canvas for compositing floor/ceiling onto the main canvas.
let _offCanvas: HTMLCanvasElement | null = null;
let _offCtx: CanvasRenderingContext2D | null = null;
let _imageData: ImageData | null = null;
let _offW = 0;
let _offH = 0;

// Reusable typed arrays for per-column ray data (avoid per-frame allocation + GC pressure)
let _colDnX: Float64Array | null = null;
let _colDnY: Float64Array | null = null;
let _colInvCos: Float64Array | null = null;
let _colFloorStart: Int32Array | null = null;
let _colCeilingEnd: Int32Array | null = null;
let _colValid: Uint8Array | null = null;
// Per-column factors: worldX = camX + factorX[col] * perpDist, worldY = camY + factorY[col] * perpDist
let _colFactorX: Float64Array | null = null;
let _colFactorY: Float64Array | null = null;
let _arrayWidth = 0;

/** Ensure offscreen canvas and ImageData are allocated at the correct size. */
function ensureOffscreen(w: number, h: number): void {
    if (_offW !== w || _offH !== h || !_offCanvas) {
        _offCanvas = document.createElement('canvas');
        _offCanvas.width = w;
        _offCanvas.height = h;
        _offCtx = _offCanvas.getContext('2d')!;
        _imageData = _offCtx.createImageData(w, h);
        _offW = w;
        _offH = h;
    }
}

/** Ensure per-column typed arrays are allocated at the correct width. */
function ensureArrays(w: number): void {
    if (_arrayWidth !== w) {
        _colDnX = new Float64Array(w);
        _colDnY = new Float64Array(w);
        _colInvCos = new Float64Array(w);
        _colFloorStart = new Int32Array(w);
        _colCeilingEnd = new Int32Array(w);
        _colValid = new Uint8Array(w);
        _colFactorX = new Float64Array(w);
        _colFactorY = new Float64Array(w);
        _arrayWidth = w;
    }
}

/**
 * Binary search for the first column (>= lo) where factorArr[col] * perpDist + camCoord >= threshold.
 * factorArr must be monotonically non-decreasing in [lo, hi).
 * Returns hi if no column satisfies.
 */
function findFirstColumnAbove(
    factorArr: Float64Array, perpDist: number, camCoord: number,
    threshold: number, lo: number, hi: number
): number {
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (camCoord + factorArr[mid] * perpDist >= threshold) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return lo;
}

/**
 * Binary search for the last column (< hi) where factorArr[col] * perpDist + camCoord <= threshold.
 * factorArr must be monotonically non-decreasing in [lo, hi).
 * Returns lo - 1 if no column satisfies.
 */
function findLastColumnBelow(
    factorArr: Float64Array, perpDist: number, camCoord: number,
    threshold: number, lo: number, hi: number
): number {
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (camCoord + factorArr[mid] * perpDist <= threshold) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo - 1;
}

/**
 * Render polygon floors and ceilings for the visible columns.
 * 
 * Call this AFTER the ZBuffer is populated (so wall bounds are known)
 * but BEFORE walls are drawn (so floors appear behind walls).
 * 
 * Uses row-major iteration: outer loop over rows, inner loop over columns.
 * This ensures sequential memory access for pixel writes (each row is
 * contiguous in the ImageData buffer), improving CPU cache performance.
 * perpDist is precomputed once per row and shared across all columns.
 * 
 * Only pixels inside polygon boundaries are rendered. Pixels outside all
 * polygons are skipped — the background from drawFloor() is already correct
 * for those regions. This typically reduces pixel processing by 95%+.
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
    textureProvider: ITextureProvider | null = null,
): void {
    const { screenWidth, screenHeight, halfHeightConstant } = config;
    const halfScreen = screenHeight / 2;
    const halfScreenCeil = Math.ceil(halfScreen);
    const halfScreenFloor = Math.floor(halfScreen);
    const camX = camera.position[0];
    const camY = camera.position[1];
    const defaultFloor = worldConfig.floorMaterial ?? DEFAULT_FLOOR_MATERIAL;

    // Reuse typed arrays across frames (allocated once, reused every frame)
    ensureArrays(screenWidth);
    const colDnX = _colDnX!;
    const colDnY = _colDnY!;
    const colInvCos = _colInvCos!;
    const colFloorStart = _colFloorStart!;
    const colCeilingEnd = _colCeilingEnd!;
    const colValid = _colValid!;
    const colFactorX = _colFactorX!;
    const colFactorY = _colFactorY!;
    colValid.fill(0); // Reset validity flags for this frame

    let anyFloorPixel = false;
    let anyCeilingPixel = false;

    // Pre-extract per-column ray data into flat arrays indexed by pixel column.
    // Ray index i maps to pixel column (screenWidth - 1 - i).
    //
    // Also precompute factorX/Y: the per-column multipliers that convert perpDist
    // to world coordinates:  worldX = camX + factorX[col] * perpDist
    // factorX[col] = colDnX[col] * colInvCos[col]
    // factorY[col] = colDnY[col] * colInvCos[col]
    for (let rayIdx = 0; rayIdx < screenWidth; rayIdx++) {
        const ray = rays[rayIdx];
        if (!ray) continue;

        const pixelCol = screenWidth - 1 - rayIdx;
        const bounds = columnBounds[rayIdx];

        const dnX = ray.dn[0];
        const dnY = ray.dn[1];
        const invCos = 1 / ray.cosAngle;
        colDnX[pixelCol] = dnX;
        colDnY[pixelCol] = dnY;
        colInvCos[pixelCol] = invCos;
        colFactorX[pixelCol] = dnX * invCos;
        colFactorY[pixelCol] = dnY * invCos;
        colValid[pixelCol] = 1;

        // Floor rendering: from wall bottom (or screen center if no wall) to screen bottom.
        // Start at wallBottom + 1 to avoid painting the boundary pixel at wallBottom.
        const floorStart = bounds.hasWall
            ? Math.max(halfScreenCeil, bounds.wallBottom + 1)
            : halfScreenCeil;
        colFloorStart[pixelCol] = floorStart;

        if (floorStart < screenHeight) anyFloorPixel = true;

        // Ceiling rendering: from screen top to wall top (or screen center if no wall)
        const ceilingEnd = bounds.hasWall
            ? Math.min(halfScreenFloor, bounds.wallTop)
            : halfScreenFloor;
        colCeilingEnd[pixelCol] = ceilingEnd;

        if (ceilingEnd > 0) anyCeilingPixel = true;
    }

    // Early-out: no floor or ceiling pixels to render
    if (!anyFloorPixel && !anyCeilingPixel) return;

    // Find range of valid columns (first and last valid column indices)
    let firstValidCol = 0;
    let lastValidCol = screenWidth - 1;
    while (firstValidCol < screenWidth && !colValid[firstValidCol]) firstValidCol++;
    while (lastValidCol > firstValidCol && !colValid[lastValidCol]) lastValidCol--;
    if (firstValidCol >= screenWidth) return; // No valid columns at all

    // Compute min/max factorX and factorY across valid columns for row-level culling.
    // These determine the world-space X/Y range reachable at any given perpDist.
    let minFactorX = Infinity, maxFactorX = -Infinity;
    let minFactorY = Infinity, maxFactorY = -Infinity;
    for (let col = firstValidCol; col <= lastValidCol; col++) {
        if (!colValid[col]) continue;
        const fx = colFactorX[col];
        const fy = colFactorY[col];
        if (fx < minFactorX) minFactorX = fx;
        if (fx > maxFactorX) maxFactorX = fx;
        if (fy < minFactorY) minFactorY = fy;
        if (fy > maxFactorY) maxFactorY = fy;
    }

    // Grid bounding box for row/column culling
    const gridBounds = grid.bounds;

    // Allocate offscreen canvas and ImageData (cached, only reallocated on size change).
    ensureOffscreen(screenWidth, screenHeight);
    const imageData = _imageData!;
    const pixels = imageData.data;

    // Dirty rectangle tracking: only composite the region that was actually written.
    let dirtyMinX = screenWidth, dirtyMaxX = 0;
    let dirtyMinY = screenHeight, dirtyMaxY = 0;
    let anyPixelWritten = false;

    // Precompute perpDist base: perpDist = perpDistBase / rowOffset
    const perpDistBase = halfHeightConstant * halfScreen * 2;

    // Determine if factorX and factorY are monotonic across columns (for binary search).
    // Camera rays fan from right to left (rayIdx 0 = rightmost screen col mapped to
    // pixelCol = screenWidth-1). Typically factorX is monotonically decreasing and
    // factorY varies. We check both for monotonic increasing and decreasing.
    let fxIncreasing = true, fxDecreasing = true;
    let fyIncreasing = true, fyDecreasing = true;
    let prevFx = colFactorX[firstValidCol];
    let prevFy = colFactorY[firstValidCol];
    for (let col = firstValidCol + 1; col <= lastValidCol; col++) {
        if (!colValid[col]) continue;
        const fx = colFactorX[col];
        const fy = colFactorY[col];
        if (fx < prevFx) fxIncreasing = false;
        if (fx > prevFx) fxDecreasing = false;
        if (fy < prevFy) fyIncreasing = false;
        if (fy > prevFy) fyDecreasing = false;
        prevFx = fx;
        prevFy = fy;
    }
    const fxMonotonic = fxIncreasing || fxDecreasing;
    const fyMonotonic = fyIncreasing || fyDecreasing;

    // --- Floor pass: row-major iteration with row/column culling ---
    if (anyFloorPixel) {
        for (let row = halfScreenCeil; row < screenHeight; row++) {
            const rowOffset = row - halfScreen;
            if (rowOffset <= 0) continue;

            const perpDist = perpDistBase / rowOffset;

            // Row-level culling: compute world-space X/Y range for this row across all columns.
            // worldX ranges from camX + minFactorX*perpDist to camX + maxFactorX*perpDist
            // If this range is fully outside the grid bounding box, skip the entire row.
            if (gridBounds) {
                const worldXMin = camX + minFactorX * perpDist;
                const worldXMax = camX + maxFactorX * perpDist;
                const worldYMin = camY + minFactorY * perpDist;
                const worldYMax = camY + maxFactorY * perpDist;

                if (worldXMax < gridBounds.minX || worldXMin > gridBounds.maxX ||
                    worldYMax < gridBounds.minY || worldYMin > gridBounds.maxY) {
                    continue; // Entire row is outside grid bounds
                }
            }

            const rowBase = row * screenWidth * 4;

            // Column-range narrowing: use binary search on monotonic factor arrays
            // to find the first/last columns whose world coordinates could fall within grid bounds.
            let colStart = firstValidCol;
            let colEnd = lastValidCol;

            if (gridBounds) {
                // Narrow X range
                if (fxMonotonic) {
                    if (fxIncreasing) {
                        // factorX increasing: worldX = camX + factorX[col] * perpDist is increasing
                        const firstX = findFirstColumnAbove(colFactorX, perpDist, camX, gridBounds.minX, firstValidCol, lastValidCol + 1);
                        const lastX = findLastColumnBelow(colFactorX, perpDist, camX, gridBounds.maxX, firstValidCol, lastValidCol + 1);
                        if (firstX > colStart) colStart = firstX;
                        if (lastX < colEnd) colEnd = lastX;
                    } else {
                        // factorX decreasing: worldX is decreasing across columns
                        // First column where worldX <= maxX (search from start)
                        const firstX = findFirstColumnAbove(colFactorX, -perpDist, -camX, -gridBounds.maxX, firstValidCol, lastValidCol + 1);
                        const lastX = findLastColumnBelow(colFactorX, -perpDist, -camX, -gridBounds.minX, firstValidCol, lastValidCol + 1);
                        if (firstX > colStart) colStart = firstX;
                        if (lastX < colEnd) colEnd = lastX;
                    }
                }
                // Narrow Y range
                if (fyMonotonic) {
                    if (fyIncreasing) {
                        const firstY = findFirstColumnAbove(colFactorY, perpDist, camY, gridBounds.minY, colStart, colEnd + 1);
                        const lastY = findLastColumnBelow(colFactorY, perpDist, camY, gridBounds.maxY, colStart, colEnd + 1);
                        if (firstY > colStart) colStart = firstY;
                        if (lastY < colEnd) colEnd = lastY;
                    } else {
                        const firstY = findFirstColumnAbove(colFactorY, -perpDist, -camY, -gridBounds.maxY, colStart, colEnd + 1);
                        const lastY = findLastColumnBelow(colFactorY, -perpDist, -camY, -gridBounds.minY, colStart, colEnd + 1);
                        if (firstY > colStart) colStart = firstY;
                        if (lastY < colEnd) colEnd = lastY;
                    }
                }
            }

            if (colStart > colEnd) continue; // No columns in range

            // Cache for texture lookups within this row scan
            let lastPolygon: IPolygon | null | undefined = undefined;
            let texPixels: { data: Uint8ClampedArray, width: number, height: number } | null = null;
            // Hint polygon for spatial coherence: adjacent pixels usually land in the same polygon.
            let hintPolygon: IPolygon | null = null;

            for (let col = colStart; col <= colEnd; col++) {
                if (!colValid[col]) continue;
                if (row < colFloorStart[col]) continue;

                const actualDist = perpDist * colInvCos[col];
                const worldX = camX + colDnX[col] * actualDist;
                const worldY = camY + colDnY[col] * actualDist;

                const polygon = grid.lookupXYHint(worldX, worldY, hintPolygon);
                if (!polygon) { hintPolygon = null; continue; }
                hintPolygon = polygon;

                const material = polygon.floorMaterial ?? defaultFloor;
                if (!material) continue;

                // Re-lookup texture only when polygon changes
                if (polygon !== lastPolygon) {
                    lastPolygon = polygon;
                    texPixels = material.texture && textureProvider
                        ? textureProvider.lookupTexture(material)?.getSubTexturePixels(material.texture.index) ?? null
                        : null;
                }

                const pixelIndex = rowBase + col * 4;
                const lumen = Math.max(0.15, 1 - actualDist / 600);

                const c = material.color;
                if (texPixels) {
                    const { data: texData, width: tw, height: th } = texPixels;
                    const tx = ((Math.floor(worldX * tw / TILE_FACTOR) % tw) + tw) % tw;
                    const ty = ((Math.floor(worldY * th / TILE_FACTOR) % th) + th) % th;
                    const texIdx = (ty * tw + tx) * 4;
                    const alpha = c[3] * texData[texIdx + 3] / 255;
                    pixels[pixelIndex]     = texData[texIdx] * lumen;
                    pixels[pixelIndex + 1] = texData[texIdx + 1] * lumen;
                    pixels[pixelIndex + 2] = texData[texIdx + 2] * lumen;
                    pixels[pixelIndex + 3] = alpha * 255;
                } else {
                    pixels[pixelIndex]     = c[0] * lumen;
                    pixels[pixelIndex + 1] = c[1] * lumen;
                    pixels[pixelIndex + 2] = c[2] * lumen;
                    pixels[pixelIndex + 3] = c[3] * 255;
                }

                // Track dirty rectangle
                if (col < dirtyMinX) dirtyMinX = col;
                if (col > dirtyMaxX) dirtyMaxX = col;
                if (!anyPixelWritten) {
                    dirtyMinY = row;
                    anyPixelWritten = true;
                }
                dirtyMaxY = row;
            }
        }
    }

    // --- Ceiling pass: row-major iteration with row/column culling ---
    if (anyCeilingPixel) {
        for (let row = 0; row < halfScreenFloor; row++) {
            const rowOffset = halfScreen - row;
            if (rowOffset <= 0) continue;

            const perpDist = perpDistBase / rowOffset;

            // Row-level culling (same as floor but for ceiling)
            if (gridBounds) {
                const worldXMin = camX + minFactorX * perpDist;
                const worldXMax = camX + maxFactorX * perpDist;
                const worldYMin = camY + minFactorY * perpDist;
                const worldYMax = camY + maxFactorY * perpDist;

                if (worldXMax < gridBounds.minX || worldXMin > gridBounds.maxX ||
                    worldYMax < gridBounds.minY || worldYMin > gridBounds.maxY) {
                    continue;
                }
            }

            const rowBase = row * screenWidth * 4;

            // Column-range narrowing
            let colStart = firstValidCol;
            let colEnd = lastValidCol;

            if (gridBounds) {
                if (fxMonotonic) {
                    if (fxIncreasing) {
                        const firstX = findFirstColumnAbove(colFactorX, perpDist, camX, gridBounds.minX, firstValidCol, lastValidCol + 1);
                        const lastX = findLastColumnBelow(colFactorX, perpDist, camX, gridBounds.maxX, firstValidCol, lastValidCol + 1);
                        if (firstX > colStart) colStart = firstX;
                        if (lastX < colEnd) colEnd = lastX;
                    } else {
                        const firstX = findFirstColumnAbove(colFactorX, -perpDist, -camX, -gridBounds.maxX, firstValidCol, lastValidCol + 1);
                        const lastX = findLastColumnBelow(colFactorX, -perpDist, -camX, -gridBounds.minX, firstValidCol, lastValidCol + 1);
                        if (firstX > colStart) colStart = firstX;
                        if (lastX < colEnd) colEnd = lastX;
                    }
                }
                if (fyMonotonic) {
                    if (fyIncreasing) {
                        const firstY = findFirstColumnAbove(colFactorY, perpDist, camY, gridBounds.minY, colStart, colEnd + 1);
                        const lastY = findLastColumnBelow(colFactorY, perpDist, camY, gridBounds.maxY, colStart, colEnd + 1);
                        if (firstY > colStart) colStart = firstY;
                        if (lastY < colEnd) colEnd = lastY;
                    } else {
                        const firstY = findFirstColumnAbove(colFactorY, -perpDist, -camY, -gridBounds.maxY, colStart, colEnd + 1);
                        const lastY = findLastColumnBelow(colFactorY, -perpDist, -camY, -gridBounds.minY, colStart, colEnd + 1);
                        if (firstY > colStart) colStart = firstY;
                        if (lastY < colEnd) colEnd = lastY;
                    }
                }
            }

            if (colStart > colEnd) continue;

            // Cache for texture lookups within this row scan
            let lastPolygon: IPolygon | null | undefined = undefined;
            let texPixels: { data: Uint8ClampedArray, width: number, height: number } | null = null;
            // Hint polygon for spatial coherence
            let hintPolygon: IPolygon | null = null;

            for (let col = colStart; col <= colEnd; col++) {
                if (!colValid[col]) continue;
                if (row >= colCeilingEnd[col]) continue;

                const actualDist = perpDist * colInvCos[col];
                const worldX = camX + colDnX[col] * actualDist;
                const worldY = camY + colDnY[col] * actualDist;

                const polygon = grid.lookupXYHint(worldX, worldY, hintPolygon);
                if (!polygon?.ceilingMaterial) { hintPolygon = polygon; continue; }
                hintPolygon = polygon;

                const material = polygon.ceilingMaterial;

                // Re-lookup texture only when polygon changes
                if (polygon !== lastPolygon) {
                    lastPolygon = polygon;
                    texPixels = material.texture && textureProvider
                        ? textureProvider.lookupTexture(material)?.getSubTexturePixels(material.texture.index) ?? null
                        : null;
                }

                const pixelIndex = rowBase + col * 4;
                const lumen = Math.max(0.15, 1 - actualDist / 600);

                const c = material.color;
                if (texPixels) {
                    const { data: texData, width: tw, height: th } = texPixels;
                    const tx = ((Math.floor(worldX * tw / TILE_FACTOR) % tw) + tw) % tw;
                    const ty = ((Math.floor(worldY * th / TILE_FACTOR) % th) + th) % th;
                    const texIdx = (ty * tw + tx) * 4;
                    const alpha = c[3] * texData[texIdx + 3] / 255;
                    pixels[pixelIndex]     = texData[texIdx] * lumen;
                    pixels[pixelIndex + 1] = texData[texIdx + 1] * lumen;
                    pixels[pixelIndex + 2] = texData[texIdx + 2] * lumen;
                    pixels[pixelIndex + 3] = alpha * 255;
                } else {
                    pixels[pixelIndex]     = c[0] * lumen;
                    pixels[pixelIndex + 1] = c[1] * lumen;
                    pixels[pixelIndex + 2] = c[2] * lumen;
                    pixels[pixelIndex + 3] = c[3] * 255;
                }

                // Track dirty rectangle
                if (col < dirtyMinX) dirtyMinX = col;
                if (col > dirtyMaxX) dirtyMaxX = col;
                if (row < dirtyMinY) dirtyMinY = row;
                if (!anyPixelWritten) anyPixelWritten = true;
                if (row > dirtyMaxY) dirtyMaxY = row;
            }
        }
    }

    // Composite floor/ceiling onto main canvas via offscreen canvas.
    // Only composite the dirty rectangle if any pixels were written.
    if (anyPixelWritten && dirtyMinX <= dirtyMaxX && dirtyMinY <= dirtyMaxY) {
        const dw = dirtyMaxX - dirtyMinX + 1;
        const dh = dirtyMaxY - dirtyMinY + 1;

        // Clear only the dirty region of the offscreen canvas before writing.
        // The pixels array may have stale data outside the dirty rect from previous frames
        // (since we no longer fill(0) the entire array). Clear the dirty region rows.
        // Actually, we need to ensure pixels outside dirty rect are 0 (transparent).
        // Since we reuse the ImageData across frames, we must clear it. But clearing
        // the full buffer defeats the purpose. Instead, clear only the dirty region
        // after compositing to prepare for the next frame.
        _offCtx!.putImageData(imageData, 0, 0, dirtyMinX, dirtyMinY, dw, dh);
        context.drawImage(_offCanvas!, dirtyMinX, dirtyMinY, dw, dh, dirtyMinX, dirtyMinY, dw, dh);

        // Clear the dirty pixels in the ImageData buffer for the next frame.
        // This replaces the bulk pixels.fill(0) with a targeted clear of only the
        // pixels that were actually written.
        for (let y = dirtyMinY; y <= dirtyMaxY; y++) {
            const rowStart = (y * screenWidth + dirtyMinX) * 4;
            const rowEnd = (y * screenWidth + dirtyMaxX + 1) * 4;
            pixels.fill(0, rowStart, rowEnd);
        }
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
