import { ZBufferColumn } from './zbuffer-renderer';
import { ZBufferCore } from './zbuffer-core';
import { WallProps } from '../../drawing/wall-painter';
import { IMaterial, Face } from '../../geometry/properties';
import { geometries, resetTestRandom } from '../../testing/factories';
import { makeCamera } from '../../camera';
import { IEntityKey } from '../../geometry/entity';

beforeEach(() => resetTestRandom());

/** Create a minimal WallProps for testing ZBufferColumn */
const makeWallProps = (distance: number, alpha: number = 1, edgeId?: string): WallProps => ({
    edgeId: (edgeId ?? `edge-${distance}`) as unknown as IEntityKey,
    height: 100 / distance,
    edgeLuminosity: 0.8,
    material: { color: [255, 0, 0, alpha] } as IMaterial,
    intersection: [50, distance],
    origin: [0, 0],
    length: 10,
    rowRange: [100, 200],
    colRange: [0, 10],
    distance,
});

describe('ZBufferColumn', () => {
    describe('construction', () => {
        test('starts empty', () => {
            const col = new ZBufferColumn();
            expect(col.isFull()).toBe(false);
        });

        test('shift returns undefined when empty', () => {
            const col = new ZBufferColumn();
            expect(col.shift()).toBeUndefined();
        });
    });

    describe('add', () => {
        test('adds a wall prop and returns self for chaining', () => {
            const col = new ZBufferColumn();
            const result = col.add(makeWallProps(10));
            expect(result).toBe(col);
        });

        test('adding opaque wall marks column as full', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 1)); // alpha=1 = opaque
            expect(col.isFull()).toBe(true);
        });

        test('adding translucent wall does not mark as full', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 0.5)); // alpha=0.5 = translucent
            expect(col.isFull()).toBe(false);
        });

        test('adding invisible wall (alpha=0) does not mark as full', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 0));
            expect(col.isFull()).toBe(false);
        });

        test('multiple translucent walls do not mark as full', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 0.3));
            col.add(makeWallProps(20, 0.5));
            col.add(makeWallProps(30, 0.7));
            expect(col.isFull()).toBe(false);
        });

        test('marks full when first opaque wall is added after translucent ones', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 0.5));
            expect(col.isFull()).toBe(false);
            col.add(makeWallProps(20, 1));
            expect(col.isFull()).toBe(true);
        });
    });

    describe('shift (priority ordering)', () => {
        test('returns farthest wall first (back-to-front rendering)', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(30));
            col.add(makeWallProps(10));
            col.add(makeWallProps(20));
            const first = col.shift();
            expect(first!.distance).toBe(30);
        });

        test('returns walls in back-to-front order (farthest first)', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(50));
            col.add(makeWallProps(10));
            col.add(makeWallProps(30));
            col.add(makeWallProps(20));
            col.add(makeWallProps(40));

            const distances: number[] = [];
            let wall = col.shift();
            while (wall) {
                distances.push(wall.distance);
                wall = col.shift();
            }
            expect(distances).toEqual([50, 40, 30, 20, 10]);
        });

        test('returns undefined when all shifted out', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10));
            col.shift();
            expect(col.shift()).toBeUndefined();
        });
    });

    describe('clear', () => {
        test('removes all elements', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 1));
            col.add(makeWallProps(20));
            col.clear();
            expect(col.shift()).toBeUndefined();
        });

        test('resets isFull flag', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 1)); // opaque
            expect(col.isFull()).toBe(true);
            col.clear();
            expect(col.isFull()).toBe(false);
        });
    });

    describe('isFull', () => {
        test('is false for empty column', () => {
            const col = new ZBufferColumn();
            expect(col.isFull()).toBe(false);
        });

        test('is true after adding opaque wall', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 1));
            expect(col.isFull()).toBe(true);
        });

        test('remains true after adding more walls', () => {
            const col = new ZBufferColumn();
            col.add(makeWallProps(10, 1));
            col.add(makeWallProps(5, 0.5));
            expect(col.isFull()).toBe(true);
        });

        test('handles null material gracefully', () => {
            const col = new ZBufferColumn();
            const wall = makeWallProps(10, 1);
            (wall as any).material = null;
            col.add(wall);
            // null material => (null?.color[3] || 0) === 0, which is not 1
            expect(col.isFull()).toBe(false);
        });
    });
});

describe('ZBufferCore', () => {
    describe('metadata', () => {
        test('has name "ZBuffer (BSP)"', () => {
            const core = new ZBufferCore();
            expect(core.name).toBe('ZBuffer (BSP)');
        });

        test('requires BSP', () => {
            const core = new ZBufferCore();
            expect(core.requiresBsp).toBe(true);
        });
    });

    describe('render', () => {
        test('returns metrics with render time', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64);
            expect(result.metrics.renderTimeMs).toBeGreaterThanOrEqual(0);
        });

        test('returns edges tested count', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64);
            expect(result.metrics.edgesTested).toBeGreaterThanOrEqual(0);
        });

        test('returns edges visible count', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64);
            expect(result.metrics.edgesVisible).toBeGreaterThanOrEqual(0);
        });

        test('returns columns processed count', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64);
            expect(result.metrics.columnsProcessed).toBeGreaterThanOrEqual(0);
        });

        test('handles geometry without BSP gracefully', () => {
            const geom = geometries.from([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64);
            // Without BSP, no walk happens, so no edges tested
            expect(result.metrics.edgesTested).toBe(0);
        });

        test('detects visible edges when camera faces geometry', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64);
            // Camera faces the wall, should see something
            expect(result.metrics.edgesVisible).toBeGreaterThan(0);
        });

        test('no visible edges when camera faces away', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            // Camera faces negative y, wall is at positive y
            const cam = makeCamera({ position: [50, 0], direction: [0, -10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64);
            expect(result.metrics.edgesVisible).toBe(0);
        });
    });

    describe('buffer reuse mode', () => {
        test('creates core with buffer reuse enabled', () => {
            const core = new ZBufferCore(true);
            expect(core.name).toBe('ZBuffer (BSP)');
        });

        test('reuse mode produces same results', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const noReuse = new ZBufferCore(false);
            const withReuse = new ZBufferCore(true);

            const result1 = noReuse.render(geom, cam, 32);
            const result2 = withReuse.render(geom, cam, 32);

            expect(result1.metrics.edgesTested).toBe(result2.metrics.edgesTested);
            expect(result1.metrics.edgesVisible).toBe(result2.metrics.edgesVisible);
        });

        test('reuse mode works across multiple renders', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore(true);
            
            // First render
            const result1 = core.render(geom, cam, 32);
            // Second render with same params
            const result2 = core.render(geom, cam, 32);

            expect(result1.metrics.edgesTested).toBe(result2.metrics.edgesTested);
            expect(result1.metrics.edgesVisible).toBe(result2.metrics.edgesVisible);
        });

        test('reuse mode handles resolution change', () => {
            const geom = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore(true);

            const result1 = core.render(geom, cam, 32);
            const result2 = core.render(geom, cam, 64);

            // Different resolutions, both should work
            expect(result1.metrics).toBeDefined();
            expect(result2.metrics).toBeDefined();
        });
    });
});
