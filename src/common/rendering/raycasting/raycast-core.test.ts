import { RaycastCore } from './raycast-core';
import { geometries, resetTestRandom } from '../../testing/factories';
import { makeCamera } from '../../camera';

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
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32);
            expect(result.metrics.renderTimeMs).toBeGreaterThanOrEqual(0);
        });

        test('returns edges tested count', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32);
            expect(result.metrics.edgesTested).toBeGreaterThanOrEqual(0);
        });

        test('returns edges visible count when camera faces geometry', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32);
            expect(result.metrics.edgesVisible).toBeGreaterThan(0);
        });

        test('returns columns processed count', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32);
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
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, -10], plane: [15, 0] });
            const core = new RaycastCore();
            const result = core.render(geom, cam, 32);
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
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const lowRes = core.render(geom, cam, 8);
            const highRes = core.render(geom, cam, 64);
            // Higher resolution should test at least as many rays
            expect(highRes.metrics.columnsProcessed).toBeGreaterThanOrEqual(lowRes.metrics.columnsProcessed);
        });

        test('multiple polygons result in more edges tested', () => {
            const singlePoly = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const multiPoly = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]],
                [[0, 40], [100, 40], [100, 50], [0, 50]],
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new RaycastCore();
            const result1 = core.render(singlePoly, cam, 32);
            const result2 = core.render(multiPoly, cam, 32);
            // More geometry should mean more visible edges
            expect(result2.metrics.edgesVisible).toBeGreaterThanOrEqual(result1.metrics.edgesVisible);
        });
    });
});
