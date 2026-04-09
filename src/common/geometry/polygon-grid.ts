/**
 * Grid-based spatial index for fast polygon lookups.
 * 
 * Bins polygons into a uniform grid by their bounding boxes, enabling O(1)
 * cell lookup followed by a small point-in-polygon test. Used by the floor/ceiling
 * renderer to quickly determine which polygon contains a given world-space point.
 * 
 * Design decisions:
 * - Grid cell size is configurable (default 50 world units).
 * - Polygons that span multiple cells are stored in every cell they overlap.
 * - Lookup returns the FIRST polygon whose boundary contains the query point
 *   (determined by the winding-number algorithm in nav-graph.ts).
 * - If no polygon contains the point, returns null.
 */
import { Vector } from '../math/vector';
import { BoundingBox, IPolygon } from './polygon';
import { isPointInPolygon } from '../navigation/nav-graph';

/** Default grid cell size in world units. */
const DEFAULT_CELL_SIZE = 50;

/**
 * A grid-based spatial index mapping world-space positions to polygons.
 */
export interface IPolygonGrid {
    /** Look up the polygon that contains `point`, or null if none. */
    lookup(point: Vector): IPolygon | null;

    /** The cell size used by this grid. */
    readonly cellSize: number;

    /** Number of occupied cells. */
    readonly cellCount: number;
}

/**
 * Build a polygon grid from a list of polygons.
 * 
 * @param polygons - The polygons to index. Only polygons with a floor or ceiling
 *   material are worth indexing, but the caller decides what to pass.
 * @param cellSize - Grid cell size in world units. Smaller cells give faster
 *   lookups at the cost of more memory and build time.
 */
export function buildPolygonGrid(
    polygons: IPolygon[],
    cellSize: number = DEFAULT_CELL_SIZE,
): IPolygonGrid {
    // Map from "col,row" string key to the list of polygons that overlap that cell.
    const cells = new Map<string, IPolygon[]>();

    for (const polygon of polygons) {
        const [min, max] = polygon.boundingBox;

        // Compute the range of grid cells this bounding box overlaps.
        const colMin = Math.floor(min[0] / cellSize);
        const colMax = Math.floor(max[0] / cellSize);
        const rowMin = Math.floor(min[1] / cellSize);
        const rowMax = Math.floor(max[1] / cellSize);

        for (let col = colMin; col <= colMax; col++) {
            for (let row = rowMin; row <= rowMax; row++) {
                const key = `${col},${row}`;
                let bucket = cells.get(key);
                if (!bucket) {
                    bucket = [];
                    cells.set(key, bucket);
                }
                bucket.push(polygon);
            }
        }
    }

    return {
        cellSize,
        cellCount: cells.size,

        lookup(point: Vector): IPolygon | null {
            const col = Math.floor(point[0] / cellSize);
            const row = Math.floor(point[1] / cellSize);
            const key = `${col},${row}`;
            const bucket = cells.get(key);
            if (!bucket) return null;

            for (const polygon of bucket) {
                if (isPointInPolygon(point, polygon)) {
                    return polygon;
                }
            }
            return null;
        },
    };
}
