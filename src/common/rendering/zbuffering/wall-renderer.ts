/**
 * Pixel-based wall renderer for the ZBuffer pipeline.
 *
 * Replaces the canvas-API–based WallPainter.drawWall() path with direct pixel
 * manipulation into an offscreen ImageData buffer. All wall drawing — textured,
 * flat-color, luminosity darkening, and distance fading — is computed per-pixel
 * in a single pass, then composited onto the main canvas via putImageData/drawImage.
 *
 * Performance benefits over the canvas-API path:
 * - Eliminates hundreds of drawImage() and drawTrapezoid() calls per frame
 * - Combined luminosity + fading in a single multiply per pixel (no overlay passes)
 * - No per-wall globalAlpha state changes
 * - Offscreen canvas compositing avoids GPU→CPU sync penalties
 * - Dirty-rect tracking: only the region with actual wall pixels is composited
 * - Reusable typed arrays: cached at module level to avoid per-frame allocation
 *
 * The render order is column-by-column, walls back-to-front within each column,
 * matching the existing ZBuffer semantics. Translucent walls are alpha-blended
 * into the pixel buffer manually.
 */
import { WallProps } from '../../drawing/wall-painter';
import { IMaterial } from '../../geometry/properties';
import { IWorldConfigState } from '../../store/world-config';

/**
 * Texture provider interface for wall rendering.
 * Structurally compatible with TextureLibrary.
 */
export interface IWallTextureProvider {
    lookupTexture(material: IMaterial): {
        getSubTexturePixels(index: number): { data: Uint8ClampedArray, width: number, height: number } | null;
    } | null;
}

/** World units per texture tile repeat. Matches tileFactor in texture.ts */
const TILE_FACTOR = 20;

// --- Module-level cached resources (reused across frames) ---

let _offCanvas: HTMLCanvasElement | null = null;
let _offCtx: CanvasRenderingContext2D | null = null;
let _imageData: ImageData | null = null;
let _offW = 0;
let _offH = 0;

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

/**
 * Render all walls from the ZBuffer columns into the given canvas context.
 *
 * @param context - Main canvas 2D rendering context to composite onto
 * @param columns - Per-column wall data. Each entry is an array of WallProps
 *                  sorted ascending by distance (nearest first). The renderer
 *                  iterates back-to-front (farthest first) for correct layering.
 * @param screenWidth - Canvas width in pixels
 * @param screenHeight - Canvas height in pixels
 * @param worldConfig - World configuration (fading settings)
 * @param textureProvider - Texture lookup, or null if textures unavailable
 */
export function renderWalls(
    context: CanvasRenderingContext2D,
    columns: { walls: WallProps[], count: number }[],
    screenWidth: number,
    screenHeight: number,
    worldConfig: IWorldConfigState,
    textureProvider: IWallTextureProvider | null = null,
): void {
    // Allocate offscreen canvas and ImageData (cached, only reallocated on size change).
    ensureOffscreen(screenWidth, screenHeight);
    const imageData = _imageData!;
    const pixels = imageData.data;

    // Fading configuration
    const fadeOn = worldConfig.fadeOn;
    const hasFade = fadeOn != null;
    const shade = fadeOn ?? 0;
    const horizonDistance = worldConfig.horizonDistance ?? 300;
    const invHorizonPlus = 1 / (horizonDistance + 10);

    // Dirty rectangle tracking
    let dirtyMinX = screenWidth, dirtyMaxX = 0;
    let dirtyMinY = screenHeight, dirtyMaxY = 0;
    let anyPixelWritten = false;

    // Iterate each column
    for (let col = 0; col < columns.length; col++) {
        const column = columns[col];
        const wallCount = column.count;
        if (wallCount === 0) continue;

        const wallArray = column.walls;

        // Iterate back-to-front (farthest wall first for correct layering).
        // wallArray is sorted ascending by distance, so iterate from end to start.
        for (let wi = wallCount - 1; wi >= 0; wi--) {
            const wall = wallArray[wi];
            if (wall.height <= 0) continue;

            const material = wall.material;
            if (!material) continue;

            const color = material.color;
            if (!color || color[3] === 0) continue;

            // Column pixel range: colRange is [mapToColumn(ray), mapToColumn(ray+1)]
            // mapToColumn decreases with ray index, so colRange[0] > colRange[1]
            // i.e. colRange[0] = right edge, colRange[1] = left edge
            const colLeft = wall.colRange[1];
            const colRight = wall.colRange[0];

            // Row pixel range (clamped to screen)
            const rowTop = Math.max(0, wall.rowRange[0]);
            const rowBottom = Math.min(screenHeight, wall.rowRange[1]);
            if (rowTop >= rowBottom) continue;

            // Luminosity: per-material override or edge-based
            const lumen = material.luminosity != null ? material.luminosity : wall.edgeLuminosity;

            // Fading factor: distance-based (same as WallPainter.applyFading)
            // For simplicity we use per-wall distance (no per-column gradient for groups).
            // fadeFactor: 0 = no fade (close), 1 = fully faded (far)
            let colorScale: number;
            let fogR: number, fogG: number, fogB: number;
            if (hasFade) {
                let fadeFactor: number;
                if (material.luminosity != null) {
                    // luminosity override on material: fading based on fixed luminosity
                    fadeFactor = 1 - material.luminosity;
                } else {
                    fadeFactor = Math.min(horizonDistance, wall.distance) * invHorizonPlus;
                }
                // Combined formula: finalR = sourceR * lumen * (1 - fadeFactor) + shade * fadeFactor
                colorScale = lumen * (1 - fadeFactor);
                fogR = shade * fadeFactor;
                fogG = shade * fadeFactor;
                fogB = shade * fadeFactor;
            } else {
                colorScale = lumen;
                fogR = 0;
                fogG = 0;
                fogB = 0;
            }

            const wallAlpha = color[3]; // 0-1

            // Look up texture pixels if available
            let texPixels: { data: Uint8ClampedArray, width: number, height: number } | null = null;
            if (material.texture && textureProvider) {
                const texObj = textureProvider.lookupTexture(material);
                if (texObj) {
                    texPixels = texObj.getSubTexturePixels(material.texture.index);
                }
            }

            // Texture X coordinate (same across all rows in this column)
            let texColumnX = 0;
            let texData: Uint8ClampedArray | null = null;
            let texWidth = 0;
            let texHeight = 0;
            if (texPixels) {
                texData = texPixels.data;
                texWidth = texPixels.width;
                texHeight = texPixels.height;
                const wx = wall.textureDistance;
                texColumnX = Math.floor((texWidth * wx / TILE_FACTOR) % (texWidth - 1));
                if (texColumnX < 0) texColumnX += (texWidth - 1);
            }

            // Wall height in screen pixels (unclamped original)
            const wallFullHeight = wall.rowRange[1] - wall.rowRange[0];

            // Render each pixel column in the wall's column range
            for (let px = colLeft; px < colRight; px++) {
                if (px < 0 || px >= screenWidth) continue;

                for (let py = rowTop; py < rowBottom; py++) {
                    const pixelIndex = (py * screenWidth + px) * 4;

                    let srcR: number, srcG: number, srcB: number, srcA: number;

                    if (texData) {
                        // Texture sampling: Y coordinate maps row position to texture height
                        const rowFrac = (py - wall.rowRange[0]) / wallFullHeight;
                        const texY = Math.floor(rowFrac * texHeight);
                        const clampedTexY = Math.min(texHeight - 1, Math.max(0, texY));
                        const texIdx = (clampedTexY * texWidth + texColumnX) * 4;

                        srcR = texData[texIdx];
                        srcG = texData[texIdx + 1];
                        srcB = texData[texIdx + 2];
                        // Combine wall alpha with texture alpha
                        srcA = wallAlpha * texData[texIdx + 3] / 255;
                    } else {
                        // Flat color
                        srcR = color[0];
                        srcG = color[1];
                        srcB = color[2];
                        srcA = wallAlpha;
                    }

                    // Apply combined luminosity + fading
                    const finalR = srcR * colorScale + fogR;
                    const finalG = srcG * colorScale + fogG;
                    const finalB = srcB * colorScale + fogB;

                    if (srcA >= 1) {
                        // Fully opaque: overwrite pixel
                        pixels[pixelIndex]     = finalR;
                        pixels[pixelIndex + 1] = finalG;
                        pixels[pixelIndex + 2] = finalB;
                        pixels[pixelIndex + 3] = 255;
                    } else if (srcA > 0) {
                        // Translucent: alpha-blend over existing pixel
                        const invAlpha = 1 - srcA;
                        const dstR = pixels[pixelIndex];
                        const dstG = pixels[pixelIndex + 1];
                        const dstB = pixels[pixelIndex + 2];
                        const dstA = pixels[pixelIndex + 3] / 255;
                        const outA = srcA + dstA * invAlpha;
                        if (outA > 0) {
                            const invOutA = 1 / outA;
                            pixels[pixelIndex]     = (finalR * srcA + dstR * dstA * invAlpha) * invOutA;
                            pixels[pixelIndex + 1] = (finalG * srcA + dstG * dstA * invAlpha) * invOutA;
                            pixels[pixelIndex + 2] = (finalB * srcA + dstB * dstA * invAlpha) * invOutA;
                            pixels[pixelIndex + 3] = outA * 255;
                        }
                    }
                    // srcA === 0: skip (invisible pixel)
                }
            }

            // Update dirty rectangle
            if (colLeft < dirtyMinX) dirtyMinX = Math.max(0, colLeft);
            if (colRight > dirtyMaxX) dirtyMaxX = Math.min(screenWidth, colRight);
            if (rowTop < dirtyMinY) dirtyMinY = rowTop;
            if (rowBottom > dirtyMaxY) dirtyMaxY = rowBottom;
            anyPixelWritten = true;
        }
    }

    // Composite wall pixels onto main canvas via offscreen canvas.
    if (anyPixelWritten && dirtyMinX < dirtyMaxX && dirtyMinY < dirtyMaxY) {
        const dw = dirtyMaxX - dirtyMinX;
        const dh = dirtyMaxY - dirtyMinY;

        _offCtx!.putImageData(imageData, 0, 0, dirtyMinX, dirtyMinY, dw, dh);
        context.drawImage(_offCanvas!, dirtyMinX, dirtyMinY, dw, dh, dirtyMinX, dirtyMinY, dw, dh);

        // Clear the dirty pixels in the ImageData buffer for the next frame.
        for (let y = dirtyMinY; y < dirtyMaxY; y++) {
            const rowStart = (y * screenWidth + dirtyMinX) * 4;
            const rowEnd = (y * screenWidth + dirtyMaxX) * 4;
            pixels.fill(0, rowStart, rowEnd);
        }
    }
}
