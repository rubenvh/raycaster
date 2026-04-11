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
 *   (determined by the winding-number algorithm).
 * - If no polygon contains the point, returns null.
 * 
 * Performance optimizations:
 * - Numeric Map keys (packed integer) instead of string keys to avoid
 *   per-lookup string allocation and hashing overhead.
 * - lookupXY(x, y) accepts raw numbers to avoid per-call Vector allocation.
 * - Bounding box early-out skips lookups for points outside all polygons.
 * - Cell key coherence cache skips Map.get for consecutive same-cell lookups.
 * - Inline point-in-polygon avoids cross-module function call overhead.
 * - Multiplication by 1/cellSize instead of division in hot path.
 * - Axis-aligned rectangle fast path: 4-vertex AABB polygons skip winding
 *   number and use direct bounds comparison.
 * - lookupXYHint: hint polygon checked first to exploit spatial coherence
 *   in row-major scan patterns (adjacent pixels → same polygon).
 */
import { Vector } from '../math/vector';
import { IPolygon } from './polygon';

/** Default grid cell size in world units. */
const DEFAULT_CELL_SIZE = 50;

/**
 * Numeric key multiplier for packing (col, row) into a single number.
 * Prime, guarantees unique keys for grid indices in [-50000, 50000].
 */
const KEY_MULT = 100003;

/** Pack grid column and row into a single numeric Map key. */
function gridKey(col: number, row: number): number {
    return col * KEY_MULT + row;
}

/**
 * Fast inline point-in-polygon test using the winding number algorithm.
 * Takes raw (x, y) coordinates to avoid Vector allocation in the hot path.
 */
function pointInPolygon(px: number, py: number, polygon: IPolygon): boolean {
    let winding = 0;
    const verts = polygon.vertices;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
        const v1 = verts[i].vector;
        const v2 = verts[(i + 1) % n].vector;
        const v1y = v1[1];
        const v2y = v2[1];
        if (v1y <= py) {
            if (v2y > py) {
                // Upward crossing: isLeft > 0
                if ((v2[0] - v1[0]) * (py - v1y) - (px - v1[0]) * (v2y - v1y) > 0) {
                    winding++;
                }
            }
        } else {
            if (v2y <= py) {
                // Downward crossing: isLeft < 0
                if ((v2[0] - v1[0]) * (py - v1y) - (px - v1[0]) * (v2y - v1y) < 0) {
                    winding--;
                }
            }
        }
    }
    return winding !== 0;
}

/**
 * Check if a polygon is an axis-aligned rectangle.
 * Returns true if it has exactly 4 vertices forming an axis-aligned rectangle.
 * For such polygons, the bounding box IS the polygon, so pointInPolygon
 * can be replaced with a simple bounds check.
 */
function isAxisAlignedRect(polygon: IPolygon): boolean {
    const verts = polygon.vertices;
    if (verts.length !== 4) return false;
    // Check that all edges are axis-aligned (either dx=0 or dy=0)
    for (let i = 0; i < 4; i++) {
        const v1 = verts[i].vector;
        const v2 = verts[(i + 1) % 4].vector;
        const dx = Math.abs(v1[0] - v2[0]);
        const dy = Math.abs(v1[1] - v2[1]);
        if (dx > 1e-6 && dy > 1e-6) return false; // Diagonal edge
    }
    return true;
}

/**
 * Check if point (px, py) is inside polygon, using the fast AABB path
 * when the polygon is known to be axis-aligned.
 */
function containsPoint(
    px: number, py: number,
    polygon: IPolygon,
    isAABB: boolean,
): boolean {
    if (isAABB) {
        const [min, max] = polygon.boundingBox;
        return px >= min[0] && px <= max[0] && py >= min[1] && py <= max[1];
    }
    return pointInPolygon(px, py, polygon);
}

/**
 * Bounding box of all polygons in the grid.
 * Used by the floor renderer to skip rows/columns that can't possibly
 * intersect any polygon.
 */
export interface IGridBounds {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
}

/**
 * A grid-based spatial index mapping world-space positions to polygons.
 */
export interface IPolygonGrid {
    /** Look up the polygon that contains `point`, or null if none. */
    lookup(point: Vector): IPolygon | null;

    /** Look up the polygon containing (x, y). Avoids Vector allocation in hot paths. */
    lookupXY(x: number, y: number): IPolygon | null;

    /**
     * Look up the polygon containing (x, y), checking `hint` polygon first.
     * Exploits spatial coherence: in row-major scans, adjacent pixels usually
     * land in the same polygon. If hint contains the point, returns it immediately
     * without any grid or Map lookup.
     */
    lookupXYHint(x: number, y: number, hint: IPolygon | null): IPolygon | null;

    /** The cell size used by this grid. */
    readonly cellSize: number;

    /** Number of occupied cells. */
    readonly cellCount: number;

    /** World-space bounding box of all indexed polygons, or null if empty. */
    readonly bounds: IGridBounds | null;
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
    // Numeric-keyed Map eliminates per-lookup string allocation and hashing.
    const cells = new Map<number, IPolygon[]>();

    // Track bounding box of all polygons for early-out in lookups.
    let boundsMinX = Infinity, boundsMinY = Infinity;
    let boundsMaxX = -Infinity, boundsMaxY = -Infinity;

    // Precompute which polygons are axis-aligned rectangles for fast containment.
    const aabbFlags = new Map<IPolygon, boolean>();

    for (const polygon of polygons) {
        const [min, max] = polygon.boundingBox;

        if (min[0] < boundsMinX) boundsMinX = min[0];
        if (min[1] < boundsMinY) boundsMinY = min[1];
        if (max[0] > boundsMaxX) boundsMaxX = max[0];
        if (max[1] > boundsMaxY) boundsMaxY = max[1];

        // Detect axis-aligned rectangles during build (O(1) per polygon).
        aabbFlags.set(polygon, isAxisAlignedRect(polygon));

        // Compute the range of grid cells this bounding box overlaps.
        const colMin = Math.floor(min[0] / cellSize);
        const colMax = Math.floor(max[0] / cellSize);
        const rowMin = Math.floor(min[1] / cellSize);
        const rowMax = Math.floor(max[1] / cellSize);

        for (let col = colMin; col <= colMax; col++) {
            for (let row = rowMin; row <= rowMax; row++) {
                const key = gridKey(col, row);
                let bucket = cells.get(key);
                if (!bucket) {
                    bucket = [];
                    cells.set(key, bucket);
                }
                bucket.push(polygon);
            }
        }
    }

    const hasBounds = polygons.length > 0;
    // Multiply by reciprocal instead of dividing in the hot path.
    const invCellSize = 1 / cellSize;

    // Coherence cache: consecutive lookups in the same cell skip Map.get.
    // NaN !== NaN guarantees the first lookup always misses the cache.
    let cachedKey = NaN;
    let cachedBucket: IPolygon[] | null = null;

    /**
     * Core grid lookup: finds which polygon contains (x, y).
     * Uses cell coherence cache and AABB fast path.
     */
    function coreLookup(x: number, y: number): IPolygon | null {
        // Bounding box early-out: skip Map lookup for points outside all polygons.
        if (hasBounds && (x < boundsMinX || x > boundsMaxX || y < boundsMinY || y > boundsMaxY)) {
            return null;
        }

        const col = Math.floor(x * invCellSize);
        const row = Math.floor(y * invCellSize);
        const key = gridKey(col, row);

        // Cell coherence cache: skip Map.get when the same cell is hit consecutively.
        let bucket: IPolygon[] | null;
        if (key === cachedKey) {
            bucket = cachedBucket;
        } else {
            bucket = cells.get(key) ?? null;
            cachedKey = key;
            cachedBucket = bucket;
        }
        if (!bucket) return null;

        for (const polygon of bucket) {
            if (containsPoint(x, y, polygon, aabbFlags.get(polygon)!)) {
                return polygon;
            }
        }
        return null;
    }

    return {
        cellSize,
        cellCount: cells.size,
        bounds: hasBounds ? { minX: boundsMinX, minY: boundsMinY, maxX: boundsMaxX, maxY: boundsMaxY } : null,

        lookupXY(x: number, y: number): IPolygon | null {
            return coreLookup(x, y);
        },

        lookupXYHint(x: number, y: number, hint: IPolygon | null): IPolygon | null {
            // Check hint polygon first: if the point is still in the same polygon,
            // skip all grid/Map/bucket work entirely.
            if (hint !== null) {
                if (containsPoint(x, y, hint, aabbFlags.get(hint) ?? false)) {
                    return hint;
                }
            }
            return coreLookup(x, y);
        },

        lookup(point: Vector): IPolygon | null {
            return coreLookup(point[0], point[1]);
        },
    };
}
