import { castCameraRay, castCollisionRays, castRaysOnEdge, castRaysOnEdgeRange, EMPTY_STATS, CastedRays } from './raycaster';
import { makeRay, IRay } from '../../geometry/collision';
import { edges, geometries, resetTestRandom, materialFactory } from '../../testing/factories';
import { makeCamera, makeRays } from '../../camera';
import { IEdge } from '../../geometry/edge';
import { buildBspTree } from '../../geometry/bsp/creation';
import { Vector } from '../../math/vector';
import { createGeometry, IGeometry } from '../../geometry/geometry';
import { Face } from '../../geometry/properties';

beforeEach(() => resetTestRandom());

/**
 * Create a simple geometry with a wall that a ray can hit.
 * Wall is a horizontal line at y=20, from x=0 to x=100.
 * Camera/rays shoot from origin area toward positive y.
 */
const makeSimpleGeometry = (): IGeometry => {
    return geometries.withBsp([
        [[0, 20], [100, 20], [100, 30], [0, 30]]
    ]);
};

/**
 * Create a geometry without BSP (brute force mode).
 */
const makeGeometryWithoutBsp = (): IGeometry => {
    return geometries.from([
        [[0, 20], [100, 20], [100, 30], [0, 30]]
    ]);
};

describe('raycaster', () => {

    describe('EMPTY_STATS', () => {
        test('has default values', () => {
            expect(EMPTY_STATS.polygons.size).toBe(0);
            expect(EMPTY_STATS.edgeTests).toEqual([+Infinity, -Infinity]);
            expect(EMPTY_STATS.polygonTests).toEqual([+Infinity, -Infinity]);
            expect(EMPTY_STATS.edgeCount).toBe(0);
            expect(EMPTY_STATS.polygonCount).toBe(0);
            expect(EMPTY_STATS.edgePercentage).toBe(0);
        });
    });

    describe('castCameraRay', () => {
        test('returns hit when ray intersects wall', () => {
            const geom = makeSimpleGeometry();
            const ray = makeRay([50, 0], [0, 1]);
            const hit = castCameraRay(ray, geom);
            expect(hit).toBeDefined();
            expect(hit.distance).toBeGreaterThan(0);
            expect(hit.distance).toBeLessThan(100);
        });

        test('returns infinity distance when ray misses all geometry', () => {
            const geom = makeSimpleGeometry();
            // Ray pointing away from geometry
            const ray = makeRay([50, 0], [0, -1]);
            const hit = castCameraRay(ray, geom);
            expect(hit).toBeDefined();
            // Either no hit or infinite distance
            expect(hit.distance).toBeGreaterThan(100);
        });

        test('ignores immaterial edges (no collision)', () => {
            // castCameraRay uses edgeFilter: edge => !edge.immaterial
            // So immaterial edges should be ignored
            const geom = makeSimpleGeometry();
            // Mark all edges as immaterial
            for (const p of geom.polygons) {
                for (const e of p.edges) {
                    e.immaterial = true;
                }
            }
            // Rebuild BSP
            geom.bsp = buildBspTree(geom.polygons);
            const ray = makeRay([50, 0], [0, 1]);
            const hit = castCameraRay(ray, geom);
            // Should not find a solid hit (distance should be infinity)
            expect(hit.distance).toBe(Number.POSITIVE_INFINITY);
        });

        test('works without BSP tree (brute force)', () => {
            const geom = makeGeometryWithoutBsp();
            const ray = makeRay([50, 0], [0, 1]);
            const hit = castCameraRay(ray, geom);
            expect(hit).toBeDefined();
            expect(hit.distance).toBeGreaterThan(0);
        });
    });

    describe('castCollisionRays', () => {
        test('returns results for each ray', () => {
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const rays = makeRays(10, cam);
            const geom = makeSimpleGeometry();
            const result = castCollisionRays(rays, geom);
            expect(result.castedRays.length).toBe(rays.length);
        });

        test('returns stats with polygon information', () => {
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const rays = makeRays(5, cam);
            const geom = makeSimpleGeometry();
            const result = castCollisionRays(rays, geom);
            expect(result.stats).toBeDefined();
            expect(result.stats.polygons).toBeDefined();
        });

        test('finds hits for rays pointing at geometry', () => {
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(5, cam);
            const geom = makeSimpleGeometry();
            const result = castCollisionRays(rays, geom);
            // At least some rays should hit the wall
            const hasHits = result.castedRays.some(cr =>
                cr.hits.some(h => h.distance < Number.POSITIVE_INFINITY)
            );
            expect(hasHits).toBe(true);
        });

        test('returns infinity for rays missing geometry', () => {
            const cam = makeCamera({ position: [50, 0], direction: [0, -10], plane: [5, 0] });
            const rays = makeRays(5, cam);
            const geom = makeSimpleGeometry();
            const result = castCollisionRays(rays, geom);
            // All rays pointing away should miss
            const allMissed = result.castedRays.every(cr =>
                cr.hits.every(h => h.distance === Number.POSITIVE_INFINITY)
            );
            expect(allMissed).toBe(true);
        });

        test('ignores edges without material', () => {
            // castCollisionRays uses edgeFilter: edge => !!edge.material
            const geom = makeSimpleGeometry();
            for (const p of geom.polygons) {
                for (const e of p.edges) {
                    (e as any).material = undefined;
                }
            }
            geom.bsp = buildBspTree(geom.polygons);
            const ray = makeRay([50, 0], [0, 1]);
            const result = castCollisionRays([ray], geom);
            // No material => needsRendering returns false => infinity
            expect(result.castedRays[0].hits[0].distance).toBe(Number.POSITIVE_INFINITY);
        });

        test('hits are sorted by distance (closest first)', () => {
            // Create geometry with two walls at different distances
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 21], [0, 21]],
                [[0, 40], [100, 40], [100, 41], [0, 41]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(5, cam);
            const result = castCollisionRays(rays, geom);
            for (const cr of result.castedRays) {
                for (let i = 1; i < cr.hits.length; i++) {
                    expect(cr.hits[i].distance).toBeGreaterThanOrEqual(cr.hits[i - 1].distance);
                }
            }
        });

        test('works without BSP (falls back to brute force)', () => {
            const geom = makeGeometryWithoutBsp();
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(3, cam);
            const result = castCollisionRays(rays, geom);
            expect(result.castedRays.length).toBe(rays.length);
        });
    });

    describe('castRaysOnEdge', () => {
        test('returns hits for rays intersecting the edge', () => {
            // Edge: horizontal line at y=20 from x=0 to x=100
            const edge = edges.from([0, 20], [100, 20]);
            // Rays from y=0 pointing upward (positive y)
            const rays: IRay[] = [
                makeRay([25, 0], [0, 1]),
                makeRay([50, 0], [0, 1]),
                makeRay([75, 0], [0, 1]),
            ];
            const hits = castRaysOnEdge(rays, edge);
            expect(hits.length).toBe(3);
            // Each should hit the edge
            for (const hit of hits) {
                expect(hit.intersection).not.toBeNull();
                expect(hit.distance).toBeGreaterThan(0);
            }
        });

        test('returns infinity for rays missing the edge', () => {
            const edge = edges.from([0, 20], [100, 20]);
            // Rays pointing away from the edge
            const rays: IRay[] = [
                makeRay([50, 0], [0, -1]),
                makeRay([50, 0], [1, 0]),
            ];
            const hits = castRaysOnEdge(rays, edge);
            expect(hits.length).toBe(2);
            for (const hit of hits) {
                expect(hit.distance).toBe(Number.POSITIVE_INFINITY);
            }
        });

        test('returns array of same length as input rays', () => {
            const edge = edges.from([0, 20], [100, 20]);
            const rays: IRay[] = [
                makeRay([10, 0], [0, 1]),
                makeRay([20, 0], [0, 1]),
                makeRay([30, 0], [0, 1]),
                makeRay([40, 0], [0, 1]),
                makeRay([50, 0], [0, 1]),
            ];
            const hits = castRaysOnEdge(rays, edge);
            expect(hits.length).toBe(5);
        });

        test('handles empty rays array', () => {
            const edge = edges.from([0, 20], [100, 20]);
            const hits = castRaysOnEdge([], edge);
            expect(hits.length).toBe(0);
        });
    });

    describe('castRaysOnEdgeRange', () => {
        test('casts rays only within specified range', () => {
            const edge = edges.from([0, 20], [100, 20]);
            const rays: IRay[] = [
                makeRay([10, 0], [0, 1]),
                makeRay([30, 0], [0, 1]),
                makeRay([50, 0], [0, 1]),
                makeRay([70, 0], [0, 1]),
                makeRay([90, 0], [0, 1]),
            ];
            // Only cast rays at index 1-3 (exclusive end)
            const hits = castRaysOnEdgeRange(rays, 1, 4, edge);
            expect(hits.length).toBe(3); // end - start = 4 - 1 = 3
        });

        test('start=0 end=length is same as castRaysOnEdge', () => {
            const edge = edges.from([0, 20], [100, 20]);
            const rays: IRay[] = [
                makeRay([25, 0], [0, 1]),
                makeRay([50, 0], [0, 1]),
                makeRay([75, 0], [0, 1]),
            ];
            const rangeHits = castRaysOnEdgeRange(rays, 0, rays.length, edge);
            const allHits = castRaysOnEdge(rays, edge);
            expect(rangeHits.length).toBe(allHits.length);
            for (let i = 0; i < rangeHits.length; i++) {
                expect(rangeHits[i].distance).toBeCloseTo(allHits[i].distance, 5);
            }
        });

        test('empty range returns empty array', () => {
            const edge = edges.from([0, 20], [100, 20]);
            const rays: IRay[] = [
                makeRay([50, 0], [0, 1]),
            ];
            const hits = castRaysOnEdgeRange(rays, 0, 0, edge);
            expect(hits.length).toBe(0);
        });

        test('single element range returns single hit', () => {
            const edge = edges.from([0, 20], [100, 20]);
            const rays: IRay[] = [
                makeRay([50, 0], [0, 1]),
                makeRay([60, 0], [0, 1]),
            ];
            const hits = castRaysOnEdgeRange(rays, 1, 2, edge);
            expect(hits.length).toBe(1);
        });

        test('hit distances match ray-edge geometry', () => {
            // Edge at y=20, rays from y=0
            const edge = edges.from([0, 20], [100, 20]);
            const rays: IRay[] = [
                makeRay([50, 0], [0, 1]),
            ];
            const hits = castRaysOnEdgeRange(rays, 0, 1, edge);
            expect(hits[0].intersection).not.toBeNull();
            // Distance should be ~20 (from y=0 to y=20)
            expect(hits[0].distance).toBeCloseTo(20, 0);
        });

        test('preserves edge reference in hits', () => {
            const edge = edges.from([0, 20], [100, 20]);
            const rays: IRay[] = [makeRay([50, 0], [0, 1])];
            const hits = castRaysOnEdgeRange(rays, 0, 1, edge);
            if (hits[0].intersection) {
                expect(hits[0].edge).toBe(edge);
            }
        });
    });
});
