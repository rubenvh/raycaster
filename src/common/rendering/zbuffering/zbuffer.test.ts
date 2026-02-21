import { ZBufferColumn } from './zbuffer-renderer';
import { ZBufferCore, isStaleInBsp, collectDirtyEdges } from './zbuffer-core';
import { WallProps } from '../../drawing/wall-painter';
import { IMaterial, Face } from '../../geometry/properties';
import { geometries, resetTestRandom } from '../../testing/factories';
import { makeCamera } from '../../camera';
import { IEntityKey } from '../../geometry/entity';
import { IBspContext, IMutableEdgeDiff } from '../../store/bsp-state';

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
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64, bspContext);
            expect(result.metrics.renderTimeMs).toBeGreaterThanOrEqual(0);
        });

        test('returns edges tested count', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64, bspContext);
            expect(result.metrics.edgesTested).toBeGreaterThanOrEqual(0);
        });

        test('returns edges visible count', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64, bspContext);
            expect(result.metrics.edgesVisible).toBeGreaterThanOrEqual(0);
        });

        test('returns columns processed count', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64, bspContext);
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
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64, bspContext);
            // Camera faces the wall, should see something
            expect(result.metrics.edgesVisible).toBeGreaterThan(0);
        });

        test('no visible edges when camera faces away', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            // Camera faces negative y, wall is at positive y
            const cam = makeCamera({ position: [50, 0], direction: [0, -10], plane: [15, 0] });
            const core = new ZBufferCore();
            const result = core.render(geom, cam, 64, bspContext);
            expect(result.metrics.edgesVisible).toBe(0);
        });
    });

    describe('buffer reuse mode', () => {
        test('creates core with buffer reuse enabled', () => {
            const core = new ZBufferCore(true);
            expect(core.name).toBe('ZBuffer (BSP)');
        });

        test('reuse mode produces same results', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const noReuse = new ZBufferCore(false);
            const withReuse = new ZBufferCore(true);

            const result1 = noReuse.render(geom, cam, 32, bspContext);
            const result2 = withReuse.render(geom, cam, 32, bspContext);

            expect(result1.metrics.edgesTested).toBe(result2.metrics.edgesTested);
            expect(result1.metrics.edgesVisible).toBe(result2.metrics.edgesVisible);
        });

        test('reuse mode works across multiple renders', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore(true);
            
            // First render
            const result1 = core.render(geom, cam, 32, bspContext);
            // Second render with same params
            const result2 = core.render(geom, cam, 32, bspContext);

            expect(result1.metrics.edgesTested).toBe(result2.metrics.edgesTested);
            expect(result1.metrics.edgesVisible).toBe(result2.metrics.edgesVisible);
        });

        test('reuse mode handles resolution change', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            const core = new ZBufferCore(true);

            const result1 = core.render(geom, cam, 32, bspContext);
            const result2 = core.render(geom, cam, 64, bspContext);

            // Different resolutions, both should work
            expect(result1.metrics).toBeDefined();
            expect(result2.metrics).toBeDefined();
        });
    });

    describe('dirty edge handling', () => {
        /** Helper to create an empty dirty diff */
        const emptyDiff = (): IMutableEdgeDiff => ({
            removedEdgeIds: new Set(),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set(),
        });

        /** Helper to collect all edge IDs from geometry */
        const allEdgeIds = (geom: ReturnType<typeof geometries.from>): IEntityKey[] =>
            geom.polygons.flatMap(p => p.edges.map(e => e.id!).filter(Boolean));

        /** Standard test setup: camera facing a wall */
        const setup = () => {
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 20], [100, 20], [100, 30], [0, 30]]
            ]);
            const cam = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
            return { geom, bsp, bspContext, cam };
        };

        test('skips stale edges in BSP walk', () => {
            const { geom, bsp, bspContext, cam } = setup();
            const core = new ZBufferCore();

            // Get baseline without dirty edges
            const baseline = core.render(geom, cam, 64, bspContext);
            expect(baseline.metrics.edgesVisible).toBeGreaterThan(0);

            // Mark ALL edges as removed (stale) — BSP walk should skip them all
            const ids = allEdgeIds(geom);
            const diff = emptyDiff();
            for (const id of ids) diff.removedEdgeIds.add(id);

            const result = core.render(geom, cam, 64, { tree: bsp, dirtyEdges: diff });
            expect(result.metrics.staleEdgesSkipped).toBeGreaterThan(0);
            // Removed edges are not in current geometry, so nothing rendered via brute-force either
            // edgesTested should be 0 since all BSP edges are skipped and removed edges aren't in geometry
            // (collectDirtyEdges only picks up addedEdgeIds and modifiedEdgeIds, not removedEdgeIds)
            expect(result.metrics.dirtyEdgesTested).toBe(0);
        });

        test('renders modified edges from current geometry', () => {
            const { geom, bsp, bspContext, cam } = setup();
            const core = new ZBufferCore();

            // Mark all edges as modified — they'll be skipped in BSP walk
            // AND re-rendered from current geometry via brute-force
            const ids = allEdgeIds(geom);
            const diff = emptyDiff();
            for (const id of ids) diff.modifiedEdgeIds.add(id);

            const result = core.render(geom, cam, 64, { tree: bsp, dirtyEdges: diff });
            // Stale edges skipped in BSP walk
            expect(result.metrics.staleEdgesSkipped).toBeGreaterThan(0);
            // Dirty edges tested via brute-force (modified edges are in current geometry)
            expect(result.metrics.dirtyEdgesTested).toBeGreaterThan(0);
        });

        test('renders added edges not in BSP', () => {
            const { geom, bsp, bspContext, cam } = setup();
            const core = new ZBufferCore();

            // Mark all edges as "added" — they won't be in BSP (staleEdgesSkipped stays 0
            // because added edges are NOT in removedEdgeIds or modifiedEdgeIds),
            // but they'll be rendered via brute-force from current geometry
            const ids = allEdgeIds(geom);
            const diff = emptyDiff();
            for (const id of ids) diff.addedEdgeIds.add(id);

            const result = core.render(geom, cam, 64, { tree: bsp, dirtyEdges: diff });
            // Added edges are NOT stale in BSP — they were never in BSP.
            // But the BSP still contains the same edges (they just happen to also be in addedEdgeIds).
            // isStaleInBsp checks removedEdgeIds and modifiedEdgeIds, NOT addedEdgeIds.
            // So BSP walk processes them normally, AND brute-force also renders them.
            expect(result.metrics.dirtyEdgesTested).toBeGreaterThan(0);
        });

        test('removed edges disappear entirely', () => {
            const { geom, bsp, bspContext, cam } = setup();
            const core = new ZBufferCore();

            // Get baseline
            const baseline = core.render(geom, cam, 64, bspContext);
            const baselineVisible = baseline.metrics.edgesVisible;
            expect(baselineVisible).toBeGreaterThan(0);

            // Mark all edges as removed — skipped in BSP walk,
            // and removed edges are NOT in addedEdgeIds or modifiedEdgeIds, 
            // so collectDirtyEdges returns nothing
            const ids = allEdgeIds(geom);
            const diff = emptyDiff();
            for (const id of ids) diff.removedEdgeIds.add(id);

            const result = core.render(geom, cam, 64, { tree: bsp, dirtyEdges: diff });
            // All BSP edges skipped, no brute-force edges
            expect(result.metrics.staleEdgesSkipped).toBeGreaterThan(0);
            expect(result.metrics.dirtyEdgesTested).toBe(0);
            // edgesTested should be 0 (nothing passed the stale check in BSP, nothing from brute-force)
            expect(result.metrics.edgesTested).toBe(0);
        });

        test('empty dirty diff equals baseline behavior', () => {
            const { geom, bsp, bspContext, cam } = setup();
            const core = new ZBufferCore();

            const baseline = core.render(geom, cam, 64, bspContext);
            const withEmptyDiff = core.render(geom, cam, 64, { tree: bsp, dirtyEdges: emptyDiff() });

            // Empty diff = no stale edges, no dirty edges
            expect(withEmptyDiff.metrics.staleEdgesSkipped).toBe(0);
            expect(withEmptyDiff.metrics.dirtyEdgesTested).toBe(0);
            // Same edges tested and visible as baseline
            expect(withEmptyDiff.metrics.edgesTested).toBe(baseline.metrics.edgesTested);
            expect(withEmptyDiff.metrics.edgesVisible).toBe(baseline.metrics.edgesVisible);
        });

        test('metrics track stale and dirty edges', () => {
            const { geom, bsp, bspContext, cam } = setup();
            const core = new ZBufferCore();

            // Mark one edge as modified
            const ids = allEdgeIds(geom);
            const diff = emptyDiff();
            diff.modifiedEdgeIds.add(ids[0]);

            const result = core.render(geom, cam, 64, { tree: bsp, dirtyEdges: diff });
            // Should have metrics defined
            expect(result.metrics.staleEdgesSkipped).toBeDefined();
            expect(result.metrics.dirtyEdgesTested).toBeDefined();
            expect(typeof result.metrics.staleEdgesSkipped).toBe('number');
            expect(typeof result.metrics.dirtyEdgesTested).toBe('number');
        });

        test('no dirty edges param equals Phase 1 behavior', () => {
            const { geom, bspContext, cam } = setup();
            const core = new ZBufferCore();

            // Render without dirtyEdges param (undefined)
            const result = core.render(geom, cam, 64, bspContext);

            // staleEdgesSkipped and dirtyEdgesTested should still be in metrics (always populated)
            expect(result.metrics.staleEdgesSkipped).toBe(0);
            expect(result.metrics.dirtyEdgesTested).toBe(0);
            // Normal rendering should still work
            expect(result.metrics.edgesVisible).toBeGreaterThan(0);
        });
    });
});

describe('isStaleInBsp', () => {
    test('returns false for undefined edgeId', () => {
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(['a' as IEntityKey]),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set(),
        };
        expect(isStaleInBsp(undefined, diff)).toBe(false);
    });

    test('returns true for removed edge', () => {
        const id = 'test-id' as IEntityKey;
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set([id]),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set(),
        };
        expect(isStaleInBsp(id, diff)).toBe(true);
    });

    test('returns true for modified edge', () => {
        const id = 'test-id' as IEntityKey;
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set([id]),
        };
        expect(isStaleInBsp(id, diff)).toBe(true);
    });

    test('returns false for added edge', () => {
        const id = 'test-id' as IEntityKey;
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(),
            addedEdgeIds: new Set([id]),
            modifiedEdgeIds: new Set(),
        };
        expect(isStaleInBsp(id, diff)).toBe(false);
    });

    test('returns false for unknown edge', () => {
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(['other' as IEntityKey]),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set(),
        };
        expect(isStaleInBsp('unknown' as IEntityKey, diff)).toBe(false);
    });
});

describe('collectDirtyEdges', () => {
    test('returns empty array for empty diff', () => {
        const geom = geometries.from([[[0, 0], [10, 0], [10, 10], [0, 10]]]);
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set(),
        };
        expect(collectDirtyEdges(geom, diff)).toEqual([]);
    });

    test('collects edges with added IDs', () => {
        const geom = geometries.from([[[0, 0], [10, 0], [10, 10], [0, 10]]]);
        const edgeId = geom.polygons[0].edges[0].id!;
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(),
            addedEdgeIds: new Set([edgeId]),
            modifiedEdgeIds: new Set(),
        };
        const result = collectDirtyEdges(geom, diff);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(edgeId);
    });

    test('collects edges with modified IDs', () => {
        const geom = geometries.from([[[0, 0], [10, 0], [10, 10], [0, 10]]]);
        const edgeId = geom.polygons[0].edges[1].id!;
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set([edgeId]),
        };
        const result = collectDirtyEdges(geom, diff);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(edgeId);
    });

    test('does not collect removed edges (they are not in geometry)', () => {
        const geom = geometries.from([[[0, 0], [10, 0], [10, 10], [0, 10]]]);
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(['nonexistent-id' as IEntityKey]),
            addedEdgeIds: new Set(),
            modifiedEdgeIds: new Set(),
        };
        expect(collectDirtyEdges(geom, diff)).toEqual([]);
    });

    test('collects multiple dirty edges across polygons', () => {
        const geom = geometries.from([
            [[0, 0], [10, 0], [10, 10], [0, 10]],
            [[20, 0], [30, 0], [30, 10], [20, 10]]
        ]);
        const id1 = geom.polygons[0].edges[0].id!;
        const id2 = geom.polygons[1].edges[0].id!;
        const diff: IMutableEdgeDiff = {
            removedEdgeIds: new Set(),
            addedEdgeIds: new Set([id1]),
            modifiedEdgeIds: new Set([id2]),
        };
        const result = collectDirtyEdges(geom, diff);
        expect(result.length).toBe(2);
        const resultIds = result.map(e => e.id);
        expect(resultIds).toContain(id1);
        expect(resultIds).toContain(id2);
    });
});
