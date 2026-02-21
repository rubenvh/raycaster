import { configureStore, combineReducers } from '@reduxjs/toolkit';
import walls from './walls';
import bsp from './bsp-state';
import { bspListenerMiddleware } from './bsp-middleware';
import { createGeometry, IGeometry, storeGeometry, EMPTY_GEOMETRY } from '../geometry/geometry';
import { loadWalls, updateWalls, createPolygon, clonePolygon, splitEdge, 
    move, remove, expandPolygon, splitPolygon, insetPolygon, mergePolygons,
    reversePolygon, subdivideEdge, extrudeEdge, undo, redo } from './walls';
import { setBsp, IBspState } from './bsp-state';
import { buildBspTree } from '../geometry/bsp/creation';
import { resetTestRandom } from '../testing/factories';
import { IEntityKey } from '../geometry/entity';

/**
 * Helper: create a fresh store with walls + bsp slices and the middleware.
 */
function createTestStore() {
    return configureStore({
        reducer: combineReducers({ walls, bsp }),
        middleware: (getDefaultMiddleware) => 
            getDefaultMiddleware({ serializableCheck: false })
                .prepend(bspListenerMiddleware.middleware),
    });
}

type TestStore = ReturnType<typeof createTestStore>;

/**
 * Helper: collect all edge IDs from a geometry.
 */
function allEdgeIds(geometry: IGeometry): Set<IEntityKey> {
    const ids = new Set<IEntityKey>();
    for (const p of geometry.polygons) {
        for (const e of p.edges) {
            if (e.id != null) ids.add(e.id);
        }
    }
    return ids;
}

beforeEach(() => resetTestRandom());

describe('BSP middleware — edge diff tracking', () => {
    
    describe('initial state', () => {
        test('bsp starts with no tree and no dirty edges', () => {
            const store = createTestStore();
            const state = store.getState().bsp;
            expect(state.tree).toBeNull();
            expect(state.status).toBe('none');
            expect(state.dirtyCount).toBe(0);
        });
    });

    describe('loadWalls triggers clearBsp', () => {
        test('loading walls clears BSP tree and resets to none', () => {
            const store = createTestStore();
            // Set a BSP first
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            store.dispatch(setBsp(buildBspTree(geom.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');

            // Load new walls — should clear BSP
            const newGeom = createGeometry([[[0, 0], [200, 0], [200, 200]]]);
            store.dispatch(loadWalls(storeGeometry(newGeom)));
            
            expect(store.getState().bsp.tree).toBeNull();
            expect(store.getState().bsp.status).toBe('none');
            expect(store.getState().bsp.dirtyCount).toBe(0);
        });
    });

    describe('createPolygon marks edges as dirty', () => {
        test('adding a polygon marks new edges as added', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [50, 0], [50, 50], [0, 50]]));
            
            const bspState = store.getState().bsp;
            // All 4 edges should be tracked as added
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBe(4);
            expect(bspState.dirtyEdges.removedEdgeIds.size).toBe(0);
        });

        test('adding polygon to existing geometry marks only new edges', () => {
            const store = createTestStore();
            // Create initial polygon
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            const firstEdgeIds = allEdgeIds(store.getState().walls.geometry);
            
            // Set BSP as fresh to track from clean state
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.dirtyCount).toBe(0);

            // Add second polygon
            store.dispatch(createPolygon([[200, 200], [300, 200], [300, 300], [200, 300]]));
            
            const bspState = store.getState().bsp;
            // 4 new edges added, none removed
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBe(4);
            expect(bspState.dirtyEdges.removedEdgeIds.size).toBe(0);
            // Original edges are now "modified" (conservative tracking)
            expect(bspState.dirtyEdges.modifiedEdgeIds.size).toBe(4);
            expect(bspState.status).toBe('stale');
        });
    });

    describe('geometry mutations mark edges as dirty', () => {
        let store: TestStore;
        
        beforeEach(() => {
            store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            // Set BSP as fresh
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');
        });

        test('splitEdge marks edges as dirty', () => {
            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            store.dispatch(splitEdge({ edge, poligon: poly.id!, target: [50, 0] }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            expect(bspState.dirtyCount).toBeGreaterThan(0);
            // Splitting creates one new edge and modifies the existing one
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBeGreaterThanOrEqual(1);
        });

        test('move marks edges as modified', () => {
            const poly = store.getState().walls.geometry.polygons[0];
            const vertexMap = new Map([[poly.id!, poly.vertices]]);
            store.dispatch(move({ direction: [10, 10], verticesMap: vertexMap, snap: false }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            // All 4 edges should be modified (same IDs, different positions)
            expect(bspState.dirtyEdges.modifiedEdgeIds.size).toBe(4);
        });

        test('remove marks edges as dirty', () => {
            const poly = store.getState().walls.geometry.polygons[0];
            const vertexMap = new Map([[poly.id!, [poly.vertices[0]]]]);
            store.dispatch(remove(vertexMap));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            // One edge removed (the edge that started at the removed vertex)
            expect(bspState.dirtyEdges.removedEdgeIds.size).toBeGreaterThanOrEqual(1);
        });

        test('reversePolygon marks edges as dirty', () => {
            const poly = store.getState().walls.geometry.polygons[0];
            store.dispatch(reversePolygon([poly.id!]));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            expect(bspState.dirtyCount).toBeGreaterThan(0);
        });

        test('subdivideEdge marks edges as dirty', () => {
            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            store.dispatch(subdivideEdge({ edge, polygon: poly.id!, segments: 3 }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            // Original edge splits into 3 → 2 new edges added
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBeGreaterThanOrEqual(2);
        });

        test('extrudeEdge marks edges as dirty', () => {
            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            store.dispatch(extrudeEdge({ edge, polygon: poly.id!, direction: [0, -30] }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            // Extrusion creates 3 new edges
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBeGreaterThanOrEqual(2);
        });

        test('splitPolygon marks edges as dirty', () => {
            const poly = store.getState().walls.geometry.polygons[0];
            store.dispatch(splitPolygon({
                polygon: poly.id!,
                start: poly.vertices[0],
                end: poly.vertices[2],
            }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            expect(bspState.dirtyCount).toBeGreaterThan(0);
        });
    });

    describe('insetPolygon marks edges as dirty', () => {
        test('insetting a polygon adds new edges', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            const poly = store.getState().walls.geometry.polygons[0];
            store.dispatch(insetPolygon({ polygon: poly.id!, distance: 10 }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            // Inner polygon adds 4 new edges
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBe(4);
        });
    });

    describe('mergePolygons marks edges as dirty', () => {
        test('merging polygons removes and adds edges', () => {
            const store = createTestStore();
            const geom = createGeometry([
                [[0, 0], [50, 0], [50, 100], [0, 100]],
                [[50, 0], [100, 0], [100, 100], [50, 100]]
            ]);
            store.dispatch(updateWalls(geom));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            const polygonIds = store.getState().walls.geometry.polygons.map(p => p.id!);
            store.dispatch(mergePolygons({ polygons: polygonIds }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            // Shared edges are removed, boundary edges form new polygon
            expect(bspState.dirtyEdges.removedEdgeIds.size).toBeGreaterThan(0);
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBeGreaterThan(0);
        });
    });

    describe('clonePolygon marks edges as dirty', () => {
        test('cloning a polygon adds new edges', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            const poly = store.getState().walls.geometry.polygons[0];
            store.dispatch(clonePolygon({ polygons: [poly] }));
            
            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('stale');
            // Cloned polygon has 4 new edges with new IDs
            expect(bspState.dirtyEdges.addedEdgeIds.size).toBe(4);
        });
    });

    describe('undo/redo triggers edge diff', () => {
        test('undo marks edges as dirty when geometry changes', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            store.dispatch(splitEdge({ edge, poligon: poly.id!, target: [50, 0] }));
            
            // Clear dirty state
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');
            
            // Undo should mark edges dirty again
            store.dispatch(undo());
            expect(store.getState().bsp.status).toBe('stale');
            expect(store.getState().bsp.dirtyCount).toBeGreaterThan(0);
        });

        test('redo marks edges as dirty', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            
            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            store.dispatch(splitEdge({ edge, poligon: poly.id!, target: [50, 0] }));
            
            store.dispatch(undo());
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');
            
            store.dispatch(redo());
            expect(store.getState().bsp.status).toBe('stale');
            expect(store.getState().bsp.dirtyCount).toBeGreaterThan(0);
        });
    });

    describe('no-op mutations produce no diff', () => {
        test('undo at beginning produces no dirty edges', () => {
            const store = createTestStore();
            store.dispatch(undo()); // no-op: already at history start
            
            // Should not have dispatched markDirty (geometry unchanged)
            expect(store.getState().bsp.dirtyCount).toBe(0);
        });

        test('redo at end produces no dirty edges', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [50, 0], [50, 50]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            store.dispatch(redo()); // no-op: already at end
            
            expect(store.getState().bsp.status).toBe('fresh');
            expect(store.getState().bsp.dirtyCount).toBe(0);
        });
    });

    describe('accumulation across multiple mutations', () => {
        test('dirty edges accumulate across multiple edits', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            // First edit: move vertices
            const poly1 = store.getState().walls.geometry.polygons[0];
            const vertexMap1 = new Map([[poly1.id!, poly1.vertices]]);
            store.dispatch(move({ direction: [10, 0], verticesMap: vertexMap1, snap: false }));
            const dirtyAfterFirst = store.getState().bsp.dirtyCount;
            
            // Second edit: move again
            const poly2 = store.getState().walls.geometry.polygons[0];
            const vertexMap2 = new Map([[poly2.id!, poly2.vertices]]);
            store.dispatch(move({ direction: [10, 0], verticesMap: vertexMap2, snap: false }));
            const dirtyAfterSecond = store.getState().bsp.dirtyCount;
            
            // Same edges modified both times, so count stays the same
            expect(dirtyAfterSecond).toBe(dirtyAfterFirst);
        });

        test('creating then removing edges results in net cancellation', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            // Add a polygon
            store.dispatch(createPolygon([[200, 200], [300, 200], [300, 300]]));
            const addedIds = new Set(store.getState().bsp.dirtyEdges.addedEdgeIds);
            expect(addedIds.size).toBe(3); // triangle has 3 edges
            
            // Undo the add — those 3 edges should cancel out
            store.dispatch(undo());
            
            // The 3 added edges should be removed via markRemoved → net no-op for those IDs
            // But the original 4 edges may appear as modified from geometry reference change
            const bspState = store.getState().bsp;
            // The 3 triangle edges should NOT be in added anymore
            for (const id of addedIds) {
                expect(bspState.dirtyEdges.addedEdgeIds.has(id)).toBe(false);
            }
        });
    });
});
