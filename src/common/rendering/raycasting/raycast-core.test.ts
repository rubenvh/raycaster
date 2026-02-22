import { RaycastCore } from './raycast-core';
import { geometries, resetTestRandom } from '../../testing/factories';
import { makeCamera } from '../../camera';
import { IBspContext, IMutableEdgeDiff } from '../../store/bsp-state';

beforeEach(() => resetTestRandom());

describe('RaycastCore', () => {
    describe('metadata', () => {
        test('has name "Raycaster"', () => {
            const core = new RaycastCore();
            expect(core.name).toBe('Raycaster');
        });

        test('does not require BSP', () => {
            const core = new RaycastCore();
            expect(core.requiresBsp).toBe(false);
        });
    });

    describe('render', () => {
        test('returns metrics with render time', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32, bspContext);
            expect(result.metrics.renderTimeMs).toBeGreaterThanOrEqual(0);
        });

        test('returns edges tested count', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32, bspContext);
            expect(result.metrics.edgesTested).toBeGreaterThanOrEqual(0);
        });

        test('returns edges visible count when camera faces geometry', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32, bspContext);
            expect(result.metrics.edgesVisible).toBeGreaterThan(0);
        });

        test('returns columns processed count', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32, bspContext);
            expect(result.metrics.columnsProcessed).toBeGreaterThan(0);
        });

        test('handles geometry without BSP (brute force fallback)', () => {
            const geom = geometries.from([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32);
            // Should still work, just using brute-force polygon intersection
            expect(result.metrics).toBeDefined();
            expect(result.metrics.edgesVisible).toBeGreaterThan(0);
        });

        test('no visible edges when camera faces away', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, -10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32, bspContext);
            expect(result.metrics.edgesVisible).toBe(0);
        });

        test('handles empty geometry', () => {
            const geom = geometries.empty();
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 16);
            expect(result.metrics.edgesVisible).toBe(0);
            expect(result.metrics.columnsProcessed).toBe(0);
        });

        test('higher resolution creates more columns', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const lowRes = core.render(geom, cam, 8, bspContext);
            const highRes = core.render(geom, cam, 64, bspContext);
            // Higher resolution should test at least as many rays
            expect(highRes.metrics.columnsProcessed).toBeGreaterThanOrEqual(lowRes.metrics.columnsProcessed);
        });

        test('multiple polygons result in more edges tested', () => {
            const { geometry: singlePoly, bspContext: singleBspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const { geometry: multiPoly, bspContext: multiBspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]],
                [[0, 40], [100, 40], [100, 50], [0, 50]],
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result1 = core.render(singlePoly, cam, 32, singleBspContext);
            const result2 = core.render(multiPoly, cam, 32, multiBspContext);
            // More geometry should mean more visible edges
            expect(result2.metrics.edgesVisible).toBeGreaterThanOrEqual(result1.metrics.edgesVisible);
        });

        test('passes dirty edges through to castCollisionRays', () => {
            // Build BSP from a far wall, then add a closer wall as dirty
            const { bsp } = geometries.withBsp([
                [[0, 50], [100, 50], [100, 60], [0, 60]]
            ]);
            const geom = geometries.from([
                [[0, 50], [100, 50], [100, 60], [0, 60]],
                [[0, 20], [100, 20], [100, 21], [0, 21]],  // Closer dirty wall
            ]);
            const addedIds = new Set<string>();
            for (const e of geom.polygons[1].edges) {
                if (e.id) addedIds.add(e.id);
            }
            const dirtyEdges: IMutableEdgeDiff = {
                removedEdgeIds: new Set(),
                addedEdgeIds: addedIds,
                modifiedEdgeIds: new Set(),
            };
            const bspContext: IBspContext = { tree: bsp, dirtyEdges };
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore(true);  // captureHits = true
            const result = core.render(geom, cam, 32, bspContext);
            // Should see the dirty wall (visible edges > 0)
            expect(result.metrics.edgesVisible).toBeGreaterThan(0);
            // Column hits should include edges at close distance (~20)
            expect(result.columnHits).toBeDefined();
            const hasCloseHit = result.columnHits!.some(hits =>
                hits.some(h => h.distance < 30)
            );
            expect(hasCloseHit).toBe(true);
        });
    });
});
