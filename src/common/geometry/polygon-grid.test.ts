import { buildPolygonGrid } from './polygon-grid';
import { createPolygon, IPolygon } from './polygon';
import { Vector } from '../math/vector';
import { Color, IMaterial } from './properties';

/**
 * Helper: create a rectangle polygon and optionally assign floor/ceiling materials.
 */
function rect(
    x: number, y: number, w: number, h: number,
    opts?: { floor?: IMaterial; ceiling?: IMaterial },
): IPolygon {
    const poly = createPolygon([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
    ]);
    if (opts?.floor) poly.floorMaterial = opts.floor;
    if (opts?.ceiling) poly.ceilingMaterial = opts.ceiling;
    return poly;
}

const RED: IMaterial = { color: [255, 0, 0, 1] as Color };
const BLUE: IMaterial = { color: [0, 0, 255, 1] as Color };

describe('polygon-grid', () => {
    describe('buildPolygonGrid', () => {
        it('returns a grid with the correct cell size', () => {
            const grid = buildPolygonGrid([], 25);
            expect(grid.cellSize).toBe(25);
        });

        it('returns 0 cells for an empty polygon list', () => {
            const grid = buildPolygonGrid([]);
            expect(grid.cellCount).toBe(0);
        });

        it('creates cells for a single polygon', () => {
            const poly = rect(0, 0, 100, 100);
            const grid = buildPolygonGrid([poly], 50);
            // 100x100 rect at origin with cell size 50:
            // cols: floor(0/50)=0 .. floor(100/50)=2 → 3 columns
            // rows: floor(0/50)=0 .. floor(100/50)=2 → 3 rows → 9 cells
            expect(grid.cellCount).toBe(9);
        });
    });

    describe('lookup', () => {
        it('returns null when no polygons exist', () => {
            const grid = buildPolygonGrid([]);
            expect(grid.lookup([50, 50])).toBeNull();
        });

        it('returns null for a point outside all polygons', () => {
            const poly = rect(0, 0, 100, 100);
            const grid = buildPolygonGrid([poly], 50);
            expect(grid.lookup([200, 200])).toBeNull();
        });

        it('finds a polygon containing the query point', () => {
            const poly = rect(0, 0, 100, 100);
            const grid = buildPolygonGrid([poly], 50);
            expect(grid.lookup([50, 50])).toBe(poly);
        });

        it('returns null for a point in a cell but outside the polygon', () => {
            // Triangle doesn't fill its bounding box, so some cell points are outside
            const tri = createPolygon([[0, 0], [100, 0], [50, 100]]);
            const grid = buildPolygonGrid([tri], 50);
            // Point (5, 95) is in the bounding-box cell but outside the triangle
            expect(grid.lookup([5, 95])).toBeNull();
        });

        it('handles negative coordinates', () => {
            const poly = rect(-100, -100, 100, 100);
            const grid = buildPolygonGrid([poly], 50);
            expect(grid.lookup([-50, -50])).toBe(poly);
            expect(grid.lookup([50, 50])).toBeNull();
        });

        it('distinguishes between adjacent non-overlapping polygons', () => {
            const left = rect(0, 0, 100, 100, { floor: RED });
            const right = rect(100, 0, 100, 100, { floor: BLUE });
            const grid = buildPolygonGrid([left, right], 50);

            expect(grid.lookup([50, 50])).toBe(left);
            expect(grid.lookup([150, 50])).toBe(right);
        });

        it('returns the first polygon when polygons overlap', () => {
            const a = rect(0, 0, 100, 100, { floor: RED });
            const b = rect(50, 50, 100, 100, { floor: BLUE });
            const grid = buildPolygonGrid([a, b], 50);

            // Point (75, 75) is inside both — grid returns the first one
            expect(grid.lookup([75, 75])).toBe(a);

            // Point (125, 125) is only inside b
            expect(grid.lookup([125, 125])).toBe(b);
        });

        it('works with non-convex polygons', () => {
            // L-shape
            const lShape = createPolygon([
                [0, 0], [100, 0], [100, 50],
                [50, 50], [50, 100], [0, 100],
            ]);
            const grid = buildPolygonGrid([lShape], 50);

            // Inside the L
            expect(grid.lookup([25, 25])).toBe(lShape);
            expect(grid.lookup([25, 75])).toBe(lShape);
            expect(grid.lookup([75, 25])).toBe(lShape);

            // Inside bounding box but outside the L (upper-right corner)
            expect(grid.lookup([75, 75])).toBeNull();
        });

        it('works with custom cell sizes', () => {
            const poly = rect(0, 0, 200, 200);

            // Very small cells: 200/10 → cols 0..20 = 21, rows 0..20 = 21 → 441
            const smallGrid = buildPolygonGrid([poly], 10);
            expect(smallGrid.lookup([100, 100])).toBe(poly);
            expect(smallGrid.cellCount).toBe(441); // 21x21

            // Very large cells
            const largeGrid = buildPolygonGrid([poly], 500);
            expect(largeGrid.lookup([100, 100])).toBe(poly);
            expect(largeGrid.cellCount).toBe(1); // single cell
        });

        it('handles points exactly on cell boundaries', () => {
            const poly = rect(0, 0, 100, 100);
            const grid = buildPolygonGrid([poly], 50);

            // Point right on cell boundary at (50, 50) — still inside polygon
            expect(grid.lookup([50, 50])).toBe(poly);
        });

        it('handles many polygons', () => {
            // Create a 5x5 grid of rectangles
            const polys: IPolygon[] = [];
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    polys.push(rect(col * 110, row * 110, 100, 100));
                }
            }
            const grid = buildPolygonGrid(polys, 50);

            // Check center of each polygon
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    const center: Vector = [col * 110 + 50, row * 110 + 50];
                    expect(grid.lookup(center)).toBe(polys[row * 5 + col]);
                }
            }

            // Check gaps between polygons
            expect(grid.lookup([105, 105])).toBeNull();
        });
    });
});
