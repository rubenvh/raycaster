import { configureStore, combineReducers } from '@reduxjs/toolkit';
import walls from './walls';
import bsp from './bsp-state';
import selection from './selection';
import { bspListenerMiddleware, patchBspEdgeMaterials, patchBspPolygonSurfaces } from './bsp-middleware';
import { createGeometry, IGeometry, storeGeometry, EMPTY_GEOMETRY } from '../geometry/geometry';
import { loadWalls, updateWalls, createPolygon, clonePolygon, splitEdge, 
    move, remove, expandPolygon, splitPolygon, insetPolygon, mergePolygons,
    reversePolygon, subdivideEdge, extrudeEdge, adaptEdges, adaptPolygonSurfaces, undo, redo } from './walls';
import { setBsp, IBspState } from './bsp-state';
import { startNewSelection } from './selection';
import { selectEdge, selectPolygon } from '../selection/selectable';
import { buildBspTree } from '../geometry/bsp/creation';
import { resetTestRandom } from '../testing/factories';
import { IEntityKey } from '../geometry/entity';
import { IBSPNode, isLeafNode, isSplitNode } from '../geometry/bsp/model';
import { IEdge } from '../geometry/edge';
import { IPolygon } from '../geometry/polygon';
import { Color } from '../geometry/properties';

/**
 * Helper: create a fresh store with walls + bsp slices and the middleware.
 */
function createTestStore() {
    return configureStore({
        reducer: combineReducers({ walls, bsp, selection }),
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
            expect(state.treeHolder).toBeNull();
            expect(state.status).toBe('none');
            expect(state.dirtyCount).toBe(0);
        });
    });

    describe('loadWalls does not affect bspState', () => {
        test('loading walls leaves BSP state unchanged (caller dispatches setBsp separately)', () => {
            const store = createTestStore();
            // Set a BSP first
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            store.dispatch(setBsp(buildBspTree(geom.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');
            const treeBefore = store.getState().bsp.treeHolder;

            // Load new walls — should NOT touch bspState
            const newGeom = createGeometry([[[0, 0], [200, 0], [200, 200]]]);
            store.dispatch(loadWalls(storeGeometry(newGeom)));
            
            // BSP state unchanged — the old tree is still there
            expect(store.getState().bsp.treeHolder).toBe(treeBefore);
            expect(store.getState().bsp.status).toBe('fresh');
            expect(store.getState().bsp.dirtyCount).toBe(0);
        });

        test('loadWalls does not trigger markDirty', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));

            // Load completely different geometry
            const newGeom = createGeometry([[[0, 0], [200, 0], [200, 200]]]);
            store.dispatch(loadWalls(storeGeometry(newGeom)));

            // No dirty edges — loadWalls is excluded from diff computation
            expect(store.getState().bsp.dirtyCount).toBe(0);
            expect(store.getState().bsp.status).toBe('fresh');
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
            // Original edges are unchanged (same polygon reference preserved by addPolygon)
            expect(bspState.dirtyEdges.modifiedEdgeIds.size).toBe(0);
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
        test('merging polygons removes shared edges and preserves boundary edges', () => {
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
            // Shared (interior) edges are removed
            expect(bspState.dirtyEdges.removedEdgeIds.size).toBeGreaterThan(0);
            // Boundary edges are preserved with same IDs, so they appear as modified
            // (not added) because the merge clones edges rather than recreating them
            expect(bspState.dirtyEdges.modifiedEdgeIds.size).toBeGreaterThan(0);
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

    describe('material-only changes patch BSP in-place (no rebuild)', () => {
        /** Collect all edges from a BSP tree by walking it. */
        function collectBspEdges(tree: IBSPNode): IEdge[] {
            const edges: IEdge[] = [];
            function walk(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    for (const p of node.polygons) edges.push(...p.edges);
                } else if (isSplitNode(node)) {
                    walk(node.front);
                    for (const p of node.coplanar) edges.push(...p.edges);
                    walk(node.back);
                }
            }
            walk(tree);
            return edges;
        }

        test('adaptEdges with material change patches BSP edges, status stays fresh', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');
            expect(store.getState().bsp.dirtyCount).toBe(0);

            // Change material on an edge (same vertices, different material)
            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            const edgeMap = new Map([[poly.id!, [edge]]]);
            const transformer = (e: any) => ({ ...e, material: { color: [0, 255, 0, 1] } });
            store.dispatch(adaptEdges({ edgeMap, transformer }));

            const bspState = store.getState().bsp;
            // Material-only change should NOT trigger markDirty or status change
            expect(bspState.status).toBe('fresh');
            expect(bspState.dirtyCount).toBe(0);

            // BSP edge should have the new material patched in-place
            const bspEdges = collectBspEdges(bspState.treeHolder!.node);
            const patchedEdge = bspEdges.find(e => e.id === edge.id);
            expect(patchedEdge).toBeDefined();
            expect((patchedEdge!.material as any).color).toEqual([0, 255, 0, 1]);
        });

        test('adaptEdges changing immateriality patches BSP edges, status stays fresh', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            
            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            const edgeMap = new Map([[poly.id!, [edge]]]);
            const transformer = (e: any) => ({ ...e, immaterial: true });
            store.dispatch(adaptEdges({ edgeMap, transformer }));

            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('fresh');
            expect(bspState.dirtyCount).toBe(0);

            // BSP edge should have immaterial patched in-place
            const bspEdges = collectBspEdges(bspState.treeHolder!.node);
            const patchedEdge = bspEdges.find(e => e.id === edge.id);
            expect(patchedEdge).toBeDefined();
            expect(patchedEdge!.immaterial).toBe(true);
        });

        test('material change without BSP tree does not crash', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            // No BSP set — tree is null
            expect(store.getState().bsp.treeHolder).toBeNull();

            const poly = store.getState().walls.geometry.polygons[0];
            const edge = poly.edges[0];
            const edgeMap = new Map([[poly.id!, [edge]]]);
            const transformer = (e: any) => ({ ...e, material: { color: [0, 0, 255, 1] } });
            // Should not throw
            store.dispatch(adaptEdges({ edgeMap, transformer }));
            expect(store.getState().bsp.treeHolder).toBeNull();
        });

        test('mixed changes: vertex move + material change fires both paths', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');

            // Move one vertex (spatial change) AND change material on another edge
            const poly = store.getState().walls.geometry.polygons[0];
            const movedEdge = poly.edges[0];
            const materialEdge = poly.edges[2];

            // Move the first vertex — affects edge[0] and edge[3]
            const vertexMap = new Map([[poly.id!, [poly.vertices[0]]]]);
            store.dispatch(move({ direction: [10, 10], verticesMap: vertexMap, snap: false }));

            // Now change material on edge[2]
            const poly2 = store.getState().walls.geometry.polygons[0];
            const stillEdge = poly2.edges[2]; 
            const edgeMap = new Map([[poly2.id!, [stillEdge]]]);
            const transformer = (e: any) => ({ ...e, material: { color: [255, 0, 255, 1] } });
            store.dispatch(adaptEdges({ edgeMap, transformer }));

            const bspState = store.getState().bsp;
            // Spatial changes from vertex move should mark status stale
            expect(bspState.status).toBe('stale');
            expect(bspState.dirtyEdges.modifiedEdgeIds.size).toBeGreaterThan(0);

            // BSP edge for the material change should be patched in-place
            const bspEdges = collectBspEdges(bspState.treeHolder!.node);
            const patchedEdge = bspEdges.find(e => e.id === materialEdge.id);
            expect(patchedEdge).toBeDefined();
            expect((patchedEdge!.material as any).color).toEqual([255, 0, 255, 1]);
        });
    });

    describe('material patching after 3D panel selection (BSP edge refs in selection state)', () => {
        /** Collect all edges from a BSP tree by walking it. */
        function collectBspEdges(tree: IBSPNode): IEdge[] {
            const edges: IEdge[] = [];
            function walk(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    for (const p of node.polygons) edges.push(...p.edges);
                } else if (isSplitNode(node)) {
                    walk(node.front);
                    for (const p of node.coplanar) edges.push(...p.edges);
                    walk(node.back);
                }
            }
            walk(tree);
            return edges;
        }

        test('patching BSP edges works even when BSP edge references are stored in selection state', () => {
            // Regression test: when selecting an edge via the 3D panel, BSP tree
            // edge/polygon objects were placed directly into the selection slice.
            // Immer (used by createSlice) deep-freezes the selection state, which
            // follows object references and freezes the BSP edge objects too. Later,
            // patchBspEdgeMaterials would throw "Cannot assign to read only property
            // 'material'" when trying to mutate the frozen BSP edges in-place.
            //
            // The fix is two-layered:
            // 1. view3dSelector.ts resolves BSP refs to geometry refs before dispatch
            // 2. patchBspEdgeMaterials thaws frozen edges/polygons on demand
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');

            // Simulate 3D panel selection: get edge/polygon from BSP tree (not geometry)
            const bspTree = store.getState().bsp.treeHolder!.node;
            const bspEdges = collectBspEdges(bspTree);
            const bspEdge = bspEdges.find(e => e.id != null)!;
            // Find the polygon containing this edge in the BSP tree
            let bspPolygon: ReturnType<typeof collectBspEdges> extends (infer _)[] ? any : never;
            function findPolygon(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    for (const p of node.polygons) {
                        if (p.edges.includes(bspEdge)) bspPolygon = p;
                    }
                } else if (isSplitNode(node)) {
                    findPolygon(node.front);
                    for (const p of node.coplanar) {
                        if (p.edges.includes(bspEdge)) bspPolygon = p;
                    }
                    findPolygon(node.back);
                }
            }
            findPolygon(bspTree);

            // Store BSP edge/polygon references in selection state (as 3D panel does)
            const element = selectEdge(bspEdge, bspPolygon);
            const geometry = store.getState().walls.geometry;
            store.dispatch(startNewSelection({ elements: [element], geometry }));

            // Now change material — this triggers patchBspEdgeMaterials which mutates
            // BSP edges in-place. With the bug, the BSP edge is frozen by Immer
            // (through the selection state) and this throws.
            const geomPoly = store.getState().walls.geometry.polygons[0];
            const geomEdge = geomPoly.edges.find(e => e.id === bspEdge.id)!;
            const edgeMap = new Map([[geomPoly.id!, [geomEdge]]]);
            const transformer = (e: any) => ({ ...e, material: { color: [0, 255, 0, 1] } });

            // This should NOT throw
            expect(() => {
                store.dispatch(adaptEdges({ edgeMap, transformer }));
            }).not.toThrow();

            // BSP should remain fresh (material-only change, no rebuild needed)
            expect(store.getState().bsp.status).toBe('fresh');

            // The BSP edge should have the new material
            const updatedBspEdges = collectBspEdges(store.getState().bsp.treeHolder!.node);
            const patchedEdge = updatedBspEdges.find(e => e.id === bspEdge.id);
            expect(patchedEdge).toBeDefined();
            expect((patchedEdge!.material as any).color).toEqual([0, 255, 0, 1]);
        });
    });

    describe('patchBspEdgeMaterials unit tests', () => {
        test('patches matching edges in leaf nodes', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const tree = buildBspTree(geom.polygons);
            const edge = geom.polygons[0].edges[0];
            
            const newEdge = { ...edge, material: { color: [0, 255, 0, 1] as any }, immaterial: true };
            const patches = new Map<IEntityKey, IEdge>([[edge.id!, newEdge as IEdge]]);
            
            patchBspEdgeMaterials(tree, patches);
            
            // Find the edge in BSP and verify it was patched
            const bspEdges: IEdge[] = [];
            function collectEdges(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    for (const p of node.polygons) bspEdges.push(...p.edges);
                } else if (isSplitNode(node)) {
                    collectEdges(node.front);
                    for (const p of node.coplanar) bspEdges.push(...p.edges);
                    collectEdges(node.back);
                }
            }
            collectEdges(tree);
            
            const patched = bspEdges.find(e => e.id === edge.id);
            expect(patched).toBeDefined();
            expect((patched!.material as any).color).toEqual([0, 255, 0, 1]);
            expect(patched!.immaterial).toBe(true);
        });

        test('empty patches map is a no-op', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const tree = buildBspTree(geom.polygons);
            const edgeBefore = geom.polygons[0].edges[0];
            const materialBefore = edgeBefore.material;
            
            patchBspEdgeMaterials(tree, new Map());
            
            // Edge should be unchanged
            const bspEdges: IEdge[] = [];
            function collectEdges(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    for (const p of node.polygons) bspEdges.push(...p.edges);
                } else if (isSplitNode(node)) {
                    collectEdges(node.front);
                    for (const p of node.coplanar) bspEdges.push(...p.edges);
                    collectEdges(node.back);
                }
            }
            collectEdges(tree);
            
            const edge = bspEdges.find(e => e.id === edgeBefore.id);
            expect(edge!.material).toBe(materialBefore);
        });

        test('patches split edges (same ID appears multiple times in BSP)', () => {
            // Create geometry with two polygons that share an edge — BSP splitting
            // may clone edges, but cloned edges keep the same ID.
            // We use a larger geometry to increase chance of BSP splitting.
            const geom = createGeometry([
                [[0, 0], [200, 0], [200, 200], [0, 200]],
                [[200, 0], [400, 0], [400, 200], [200, 200]],
            ]);
            const tree = buildBspTree(geom.polygons);
            
            // Pick an edge and patch it
            const targetEdge = geom.polygons[0].edges[0];
            const newMaterial = { color: [128, 128, 128, 0.5] as any };
            const newEdge = { ...targetEdge, material: newMaterial } as IEdge;
            const patches = new Map<IEntityKey, IEdge>([[targetEdge.id!, newEdge]]);
            
            patchBspEdgeMaterials(tree, patches);
            
            // Collect ALL edges with this ID from BSP (may be split into multiple fragments)
            const matchingEdges: IEdge[] = [];
            function collectEdges(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    for (const p of node.polygons) {
                        for (const e of p.edges) {
                            if (e.id === targetEdge.id) matchingEdges.push(e);
                        }
                    }
                } else if (isSplitNode(node)) {
                    collectEdges(node.front);
                    for (const p of node.coplanar) {
                        for (const e of p.edges) {
                            if (e.id === targetEdge.id) matchingEdges.push(e);
                        }
                    }
                    collectEdges(node.back);
                }
            }
            collectEdges(tree);
            
            // All fragments should be patched
            expect(matchingEdges.length).toBeGreaterThanOrEqual(1);
            for (const e of matchingEdges) {
                expect((e.material as any).color).toEqual([128, 128, 128, 0.5]);
            }
        });
    });

    describe('patchBspPolygonSurfaces unit tests', () => {
        /** Collect all polygons from a BSP tree by walking it. */
        function collectBspPolygons(tree: IBSPNode): IPolygon[] {
            const polygons: IPolygon[] = [];
            function walk(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    polygons.push(...node.polygons);
                } else if (isSplitNode(node)) {
                    walk(node.front);
                    polygons.push(...node.coplanar);
                    walk(node.back);
                }
            }
            walk(tree);
            return polygons;
        }

        test('patches floor material on matching polygon in BSP', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const tree = buildBspTree(geom.polygons);
            const polyId = geom.polygons[0].id!;

            const patches = new Map([[polyId, {
                floorMaterial: { color: [100, 50, 25, 1] as Color },
                ceilingMaterial: undefined,
            }]]);

            patchBspPolygonSurfaces(tree, patches);

            const bspPolygons = collectBspPolygons(tree);
            const patched = bspPolygons.find(p => p.id === polyId);
            expect(patched).toBeDefined();
            expect(patched!.floorMaterial).toEqual({ color: [100, 50, 25, 1] });
            expect(patched!.ceilingMaterial).toBeUndefined();
        });

        test('patches ceiling material on matching polygon in BSP', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const tree = buildBspTree(geom.polygons);
            const polyId = geom.polygons[0].id!;

            const patches = new Map([[polyId, {
                floorMaterial: undefined,
                ceilingMaterial: { color: [200, 200, 200, 1] as Color },
            }]]);

            patchBspPolygonSurfaces(tree, patches);

            const bspPolygons = collectBspPolygons(tree);
            const patched = bspPolygons.find(p => p.id === polyId);
            expect(patched).toBeDefined();
            expect(patched!.ceilingMaterial).toEqual({ color: [200, 200, 200, 1] });
        });

        test('patches both floor and ceiling materials', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const tree = buildBspTree(geom.polygons);
            const polyId = geom.polygons[0].id!;

            const patches = new Map([[polyId, {
                floorMaterial: { color: [100, 50, 25, 1] as Color },
                ceilingMaterial: { color: [200, 200, 200, 1] as Color },
            }]]);

            patchBspPolygonSurfaces(tree, patches);

            const bspPolygons = collectBspPolygons(tree);
            const patched = bspPolygons.find(p => p.id === polyId);
            expect(patched).toBeDefined();
            expect(patched!.floorMaterial).toEqual({ color: [100, 50, 25, 1] });
            expect(patched!.ceilingMaterial).toEqual({ color: [200, 200, 200, 1] });
        });

        test('empty patches map is a no-op', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const tree = buildBspTree(geom.polygons);

            patchBspPolygonSurfaces(tree, new Map());

            const bspPolygons = collectBspPolygons(tree);
            const poly = bspPolygons.find(p => p.id === geom.polygons[0].id);
            expect(poly!.floorMaterial).toBeUndefined();
            expect(poly!.ceilingMaterial).toBeUndefined();
        });

        test('patches split polygon (same ID in multiple BSP nodes)', () => {
            // Create a non-convex polygon that BSP will split
            const geom = createGeometry([
                [[0, 0], [200, 0], [200, 200], [100, 100], [0, 200]],
            ]);
            const tree = buildBspTree(geom.polygons);
            const polyId = geom.polygons[0].id!;

            const patches = new Map([[polyId, {
                floorMaterial: { color: [50, 100, 150, 1] as Color },
                ceilingMaterial: { color: [200, 100, 50, 1] as Color },
            }]]);

            patchBspPolygonSurfaces(tree, patches);

            // All split fragments should have the patched materials
            const bspPolygons = collectBspPolygons(tree);
            const matchingPolys = bspPolygons.filter(p => p.id === polyId);
            expect(matchingPolys.length).toBeGreaterThanOrEqual(1);
            for (const p of matchingPolys) {
                expect(p.floorMaterial).toEqual({ color: [50, 100, 150, 1] });
                expect(p.ceilingMaterial).toEqual({ color: [200, 100, 50, 1] });
            }
        });
    });

    describe('adaptPolygonSurfaces patches BSP in-place (no rebuild)', () => {
        /** Collect all polygons from a BSP tree by walking it. */
        function collectBspPolygons(tree: IBSPNode): IPolygon[] {
            const polygons: IPolygon[] = [];
            function walk(node: IBSPNode): void {
                if (isLeafNode(node)) {
                    polygons.push(...node.polygons);
                } else if (isSplitNode(node)) {
                    walk(node.front);
                    polygons.push(...node.coplanar);
                    walk(node.back);
                }
            }
            walk(tree);
            return polygons;
        }

        test('setting floor material patches BSP, status stays fresh', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));
            expect(store.getState().bsp.status).toBe('fresh');

            const polyId = store.getState().walls.geometry.polygons[0].id!;
            store.dispatch(adaptPolygonSurfaces({
                polygonId: polyId,
                floorMaterial: { color: [100, 80, 60, 1] },
            }));

            const bspState = store.getState().bsp;
            // Surface-only change should NOT trigger markDirty or status change
            expect(bspState.status).toBe('fresh');
            expect(bspState.dirtyCount).toBe(0);

            // BSP polygon should have the new floor material patched in-place
            const bspPolygons = collectBspPolygons(bspState.treeHolder!.node);
            const patched = bspPolygons.find(p => p.id === polyId);
            expect(patched).toBeDefined();
            expect(patched!.floorMaterial).toEqual({ color: [100, 80, 60, 1] });
        });

        test('setting ceiling material patches BSP, status stays fresh', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));

            const polyId = store.getState().walls.geometry.polygons[0].id!;
            store.dispatch(adaptPolygonSurfaces({
                polygonId: polyId,
                ceilingMaterial: { color: [200, 200, 200, 1] },
            }));

            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('fresh');

            const bspPolygons = collectBspPolygons(bspState.treeHolder!.node);
            const patched = bspPolygons.find(p => p.id === polyId);
            expect(patched).toBeDefined();
            expect(patched!.ceilingMaterial).toEqual({ color: [200, 200, 200, 1] });
        });

        test('clearing floor material (null) patches BSP, status stays fresh', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            store.dispatch(setBsp(buildBspTree(store.getState().walls.geometry.polygons)));

            const polyId = store.getState().walls.geometry.polygons[0].id!;
            // Set floor material first
            store.dispatch(adaptPolygonSurfaces({
                polygonId: polyId,
                floorMaterial: { color: [100, 80, 60, 1] },
            }));
            // Now clear it
            store.dispatch(adaptPolygonSurfaces({
                polygonId: polyId,
                floorMaterial: null,
            }));

            const bspState = store.getState().bsp;
            expect(bspState.status).toBe('fresh');

            const bspPolygons = collectBspPolygons(bspState.treeHolder!.node);
            const patched = bspPolygons.find(p => p.id === polyId);
            expect(patched).toBeDefined();
            expect(patched!.floorMaterial).toBeUndefined();
        });

        test('surface change without BSP tree does not crash', () => {
            const store = createTestStore();
            store.dispatch(createPolygon([[0, 0], [100, 0], [100, 100], [0, 100]]));
            // No BSP set — tree is null
            expect(store.getState().bsp.treeHolder).toBeNull();

            const polyId = store.getState().walls.geometry.polygons[0].id!;
            expect(() => {
                store.dispatch(adaptPolygonSurfaces({
                    polygonId: polyId,
                    floorMaterial: { color: [100, 80, 60, 1] },
                }));
            }).not.toThrow();
        });
    });
});
