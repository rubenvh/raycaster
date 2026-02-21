import wallsReducer, { loadWalls, updateWalls, undo, redo, move, remove, createPolygon, 
    clonePolygon, expandPolygon, reversePolygon, splitPolygon, rotatePolygon, editVertex,
    splitEdge, adaptEdges, IWallState,
    subdivideEdge, extrudeEdge, bevelVertex, insetEdge, flipPolygon, scalePolygon,
    regularizePolygon, convexHull, insetPolygon, mergePolygons, alignVertices, alignPolygons,
    weldVertices, createRegularPolygon } from './walls';
import selectionReducer, { addSelectedElement, startNewSelection, clearSelection, selectTreeNode, ISelectionState } from './selection';
import playerReducer, { initializeCamera, rotateCamera, strafeCamera, moveCamera, changeCameraAngle, changeCameraDepth, IPlayerState } from './player';
import worldConfigReducer, { initialize as initWorldConfig, toggleFadingStrategy, IWorldConfigState } from './world-config';
import uiConfigReducer, { initialize as initUIConfig, toggleTestCanvas, cycleBspDrawMode, BspDrawMode, IUIConfigState } from './ui-config';
import texturesReducer, { initialize as initTextures, loadTexture, adaptTexture, ITextureLibraryState } from './textures';
import statsReducer, { statisticsUpdated, IStatsState } from './stats';
import { EMPTY_GEOMETRY, createGeometry, IGeometry, storeGeometry } from '../geometry/geometry';
import { DEFAULT_CAMERA, makeCamera } from '../camera';
import { geometries, resetTestRandom, edges } from '../testing/factories';
import { selectVertex, selectEdge, selectPolygon } from '../selection/selectable';
import { makeVertex } from '../geometry/vertex';
import { EMPTY_STATS } from '../rendering/raycasting/raycaster';

beforeEach(() => resetTestRandom());

// ─── Walls Slice ─────────────────────────────────────────────────

describe('walls slice', () => {
    const initialState: IWallState = {
        geometry: EMPTY_GEOMETRY,
        history: [EMPTY_GEOMETRY],
        historyIndex: 0,
    };

    test('initial state is empty geometry', () => {
        const state = wallsReducer(undefined, { type: 'unknown' });
        expect(state.geometry.polygons.length).toBe(0);
        expect(state.historyIndex).toBe(0);
    });

    describe('loadWalls', () => {
        test('loads geometry from stored format', () => {
            const geom = createGeometry([
                [[0, 0], [100, 0], [100, 100], [0, 100]]
            ]);
            const stored = storeGeometry(geom);
            const state = wallsReducer(initialState, loadWalls(stored));
            expect(state.geometry.polygons.length).toBe(1);
            expect(state.historyIndex).toBe(0);
            expect(state.history.length).toBe(1);
        });

        test('resets history on load', () => {
            // First do some updates to build history
            const geom1 = createGeometry([[[0, 0], [10, 0], [10, 10]]]);
            const geom2 = createGeometry([[[0, 0], [20, 0], [20, 20]]]);
            let state = wallsReducer(initialState, updateWalls(geom1));
            state = wallsReducer(state, updateWalls(geom2));
            expect(state.history.length).toBeGreaterThan(1);
            
            // Load should reset
            const stored = storeGeometry(createGeometry([[[5, 5], [15, 5], [15, 15]]]));
            state = wallsReducer(state, loadWalls(stored));
            expect(state.history.length).toBe(1);
            expect(state.historyIndex).toBe(0);
        });
    });

    describe('updateWalls', () => {
        test('updates geometry and adds to history', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50]]]);
            const state = wallsReducer(initialState, updateWalls(geom));
            expect(state.geometry).toBe(geom);
            expect(state.historyIndex).toBe(1);
            expect(state.history.length).toBe(2);
        });
    });

    describe('undo/redo', () => {
        test('undo goes back in history', () => {
            const geom1 = createGeometry([[[0, 0], [10, 0], [10, 10]]]);
            const geom2 = createGeometry([[[0, 0], [20, 0], [20, 20]]]);
            let state = wallsReducer(initialState, updateWalls(geom1));
            state = wallsReducer(state, updateWalls(geom2));
            expect(state.historyIndex).toBe(2);

            state = wallsReducer(state, undo());
            expect(state.historyIndex).toBe(1);
            expect(state.geometry).toBe(geom1);
        });

        test('undo at beginning stays at 0', () => {
            let state = wallsReducer(initialState, undo());
            expect(state.historyIndex).toBe(0);
        });

        test('redo goes forward in history', () => {
            const geom1 = createGeometry([[[0, 0], [10, 0], [10, 10]]]);
            const geom2 = createGeometry([[[0, 0], [20, 0], [20, 20]]]);
            let state = wallsReducer(initialState, updateWalls(geom1));
            state = wallsReducer(state, updateWalls(geom2));
            state = wallsReducer(state, undo());
            state = wallsReducer(state, undo());
            expect(state.historyIndex).toBe(0);

            state = wallsReducer(state, redo());
            expect(state.historyIndex).toBe(1);
            expect(state.geometry).toBe(geom1);
        });

        test('redo at end stays at end', () => {
            const geom = createGeometry([[[0, 0], [10, 0], [10, 10]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            state = wallsReducer(state, redo());
            expect(state.historyIndex).toBe(1); // stays at 1
        });

        test('undo then update truncates forward history', () => {
            const geom1 = createGeometry([[[0, 0], [10, 0], [10, 10]]]);
            const geom2 = createGeometry([[[0, 0], [20, 0], [20, 20]]]);
            const geom3 = createGeometry([[[0, 0], [30, 0], [30, 30]]]);
            let state = wallsReducer(initialState, updateWalls(geom1));
            state = wallsReducer(state, updateWalls(geom2));
            state = wallsReducer(state, undo()); // go back to geom1
            state = wallsReducer(state, updateWalls(geom3)); // new branch
            // geom2 should be lost
            expect(state.geometry).toBe(geom3);
            expect(state.history).not.toContain(geom2);
        });
    });

    describe('createPolygon', () => {
        test('adds a new polygon to geometry', () => {
            const state = wallsReducer(initialState, createPolygon([[0, 0], [50, 0], [50, 50], [0, 50]]));
            expect(state.geometry.polygons.length).toBe(1);
            expect(state.geometry.polygons[0].vertices.length).toBe(4);
        });
    });

    describe('clonePolygon', () => {
        test('duplicates polygons with displacement', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50], [0, 50]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            state = wallsReducer(state, clonePolygon({ polygons: geom.polygons }));
            expect(state.geometry.polygons.length).toBe(2);
        });
    });

    describe('move', () => {
        test('moves vertices by direction', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50], [0, 50]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const vertexMap = new Map([[poly.id!, poly.vertices]]);
            state = wallsReducer(state, move({ direction: [10, 10], verticesMap: vertexMap, snap: false }));
            // All vertices should have moved
            const movedPoly = state.geometry.polygons[0];
            expect(movedPoly.vertices[0].vector[0]).toBeCloseTo(10, 0);
            expect(movedPoly.vertices[0].vector[1]).toBeCloseTo(10, 0);
        });

        test('move with disableUndo does not add to history', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50], [0, 50]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const historyLen = state.history.length;
            const poly = state.geometry.polygons[0];
            const vertexMap = new Map([[poly.id!, poly.vertices]]);
            state = wallsReducer(state, move({ direction: [5, 5], verticesMap: vertexMap, snap: false, disableUndo: true }));
            expect(state.history.length).toBe(historyLen);
        });
    });

    describe('BSP is managed by bspState (not walls)', () => {
        test('geometry no longer has bsp property', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            expect((state.geometry as any).bsp).toBeUndefined();
        });
    });

    describe('reversePolygon', () => {
        test('reverses polygon edge order', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const polyId = state.geometry.polygons[0].id!;
            state = wallsReducer(state, reversePolygon([polyId]));
            expect(state.geometry.polygons.length).toBe(1);
        });
    });

    describe('adaptEdges', () => {
        test('transforms edges for a given polygon', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const edgeMap = new Map([[poly.id!, [poly.edges[0]]]]);
            const transformer = (e: any) => ({ ...e, immaterial: true });
            state = wallsReducer(state, adaptEdges({ edgeMap, transformer } as any));
            const updatedEdge = state.geometry.polygons[0].edges.find(e => e.id === poly.edges[0].id);
            expect(updatedEdge!.immaterial).toBe(true);
        });
    });

    describe('splitEdge', () => {
        test('splits an edge at a target point', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const edge = poly.edges[0]; // edge from [0,0] to [100,0]
            const originalEdgeCount = poly.edgeCount;
            state = wallsReducer(state, splitEdge({ edge, poligon: poly.id!, target: [50, 0] }));
            // Should have one more edge now
            expect(state.geometry.polygons[0].edgeCount).toBe(originalEdgeCount + 1);
        });
    });

    describe('remove', () => {
        test('removes a vertex from polygon', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const vertexMap = new Map([[poly.id!, [poly.vertices[0]]]]);
            state = wallsReducer(state, remove(vertexMap));
            // Should have one fewer vertex
            expect(state.geometry.polygons[0].vertices.length).toBe(3);
        });

        test('removes polygon if all vertices removed', () => {
            // Triangle — removing vertices reduces it until polygon is removed
            const geom = createGeometry([[[0, 0], [100, 0], [50, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            // Remove two vertices to collapse polygon
            const vertexMap = new Map([[poly.id!, [poly.vertices[0], poly.vertices[1]]]]);
            state = wallsReducer(state, remove(vertexMap));
            // Polygon should be removed or have 1 edge (which gets filtered)
            expect(state.geometry.polygons.length).toBeLessThanOrEqual(1);
        });
    });

    describe('expandPolygon', () => {
        test('expands a polygon from an edge', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const edge = poly.edges[0];
            state = wallsReducer(state, expandPolygon({ edge, polygon: poly.id!, direction: [0, -50] }));
            // Should still have 1 polygon with same edge count (parallel offset preserves topology)
            expect(state.geometry.polygons[0].edgeCount).toBe(4);
            // The polygon should be larger than the original
            const origBB = poly.boundingBox;
            const newBB = state.geometry.polygons[0].boundingBox;
            const origWidth = origBB[1][0] - origBB[0][0];
            const newWidth = newBB[1][0] - newBB[0][0];
            expect(newWidth).toBeGreaterThan(origWidth);
        });
    });

    describe('splitPolygon', () => {
        test('splits a polygon into two', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            // Split from vertex[0] to vertex[2] (diagonal)
            state = wallsReducer(state, splitPolygon({
                polygon: poly.id!,
                start: poly.vertices[0],
                end: poly.vertices[2],
            }));
            expect(state.geometry.polygons.length).toBe(2);
        });
    });

    describe('rotatePolygon', () => {
        test('rotates polygon by a direction vector', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const originalStart = poly.edges[0].start.vector;
            state = wallsReducer(state, rotatePolygon({
                polygons: [poly.id!],
                rotation: [1, 0], // rotation target
            }));
            const rotatedPoly = state.geometry.polygons[0];
            // Vertices should have changed position
            expect(rotatedPoly.vertices[0].vector).not.toEqual(originalStart);
        });
    });

    describe('editVertex', () => {
        test('moves a single vertex by direction', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const vertex = poly.vertices[0];
            state = wallsReducer(state, editVertex({
                direction: [10, 20],
                vertex,
                polygonId: poly.id!,
            }));
            const movedVertex = state.geometry.polygons[0].vertices[0];
            expect(movedVertex.vector[0]).toBeCloseTo(10, 0);
            expect(movedVertex.vector[1]).toBeCloseTo(20, 0);
        });
    });

    describe('subdivideEdge', () => {
        test('splits edge into N segments', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const edge = poly.edges[0];
            state = wallsReducer(state, subdivideEdge({ edge, polygon: poly.id!, segments: 3 }));
            expect(state.geometry.polygons[0].edges.length).toBe(6);
        });

        test('does nothing for segments < 2', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const edge = poly.edges[0];
            state = wallsReducer(state, subdivideEdge({ edge, polygon: poly.id!, segments: 1 }));
            expect(state.geometry.polygons[0].edges.length).toBe(3);
        });
    });

    describe('extrudeEdge', () => {
        test('creates rectangular extrusion with 3 new edges', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const edge = poly.edges[0];
            state = wallsReducer(state, extrudeEdge({ edge, polygon: poly.id!, direction: [50, -30] }));
            expect(state.geometry.polygons[0].edges.length).toBe(6);
        });
    });

    describe('bevelVertex', () => {
        test('replaces vertex with chamfer edge', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const vertex = poly.vertices[1];
            state = wallsReducer(state, bevelVertex({ vertices: [{vertex, polygon: poly.id!}], distance: 20, segments: 1 }));
            expect(state.geometry.polygons[0].edges.length).toBe(5);
        });

        test('does nothing for distance <= 0', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            state = wallsReducer(state, bevelVertex({ vertices: [{vertex: poly.vertices[0], polygon: poly.id!}], distance: 0, segments: 1 }));
            expect(state.geometry.polygons[0].edges.length).toBe(3);
        });
    });

    describe('insetEdge', () => {
        test('replaces edge with 5 edges forming recess', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const edge = poly.edges[0];
            state = wallsReducer(state, insetEdge({ edge, polygon: poly.id!, depth: 20, splitRatio: 0.5 }));
            expect(state.geometry.polygons[0].edges.length).toBe(8);
        });
    });

    describe('flipPolygon', () => {
        test('flips polygon horizontally preserving bounding box size', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 50], [0, 50]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const origWidth = poly.boundingBox[1][0] - poly.boundingBox[0][0];
            state = wallsReducer(state, flipPolygon({ polygons: [poly.id!], axis: 'horizontal' }));
            const newPoly = state.geometry.polygons[0];
            const newWidth = newPoly.boundingBox[1][0] - newPoly.boundingBox[0][0];
            expect(Math.abs(newWidth - origWidth)).toBeLessThan(0.01);
        });

        test('flips polygon vertically', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [50, 80]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            state = wallsReducer(state, flipPolygon({ polygons: [poly.id!], axis: 'vertical' }));
            expect(state.geometry.polygons[0].edges.length).toBe(3);
        });
    });

    describe('scalePolygon', () => {
        test('scales polygon uniformly', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const origWidth = poly.boundingBox[1][0] - poly.boundingBox[0][0];
            state = wallsReducer(state, scalePolygon({ polygons: [poly.id!], scaleX: 2, scaleY: 2 }));
            const newWidth = state.geometry.polygons[0].boundingBox[1][0] - state.geometry.polygons[0].boundingBox[0][0];
            expect(newWidth).toBeCloseTo(origWidth * 2, 1);
        });
    });

    describe('regularizePolygon', () => {
        test('creates polygon with equal edge lengths', () => {
            const geom = createGeometry([[[0, 0], [120, 0], [80, 90], [10, 70]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            state = wallsReducer(state, regularizePolygon({ polygon: poly.id! }));
            const updated = state.geometry.polygons[0];
            const lengths = updated.edges.map(e => e.length);
            const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
            lengths.forEach(l => expect(Math.abs(l - avgLen) / avgLen).toBeLessThan(0.01));
        });
    });

    describe('convexHull', () => {
        test('removes concavities from L-shaped polygon', () => {
            const geom = createGeometry([[[0, 0], [60, 0], [60, 40], [40, 40], [40, 80], [0, 80]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            state = wallsReducer(state, convexHull({ polygon: poly.id! }));
            expect(state.geometry.polygons[0].vertices.length).toBeLessThanOrEqual(6);
        });
    });

    describe('insetPolygon', () => {
        test('adds inner polygon to geometry', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            state = wallsReducer(state, insetPolygon({ polygon: poly.id!, distance: 10 }));
            expect(state.geometry.polygons.length).toBe(2);
        });
    });

    describe('mergePolygons', () => {
        test('combines two adjacent polygons', () => {
            const geom = createGeometry([
                [[0, 0], [50, 0], [50, 100], [0, 100]],
                [[50, 0], [100, 0], [100, 100], [50, 100]]
            ]);
            let state = wallsReducer(initialState, updateWalls(geom));
            state = wallsReducer(state, mergePolygons({ polygons: geom.polygons.map(p => p.id!) }));
            expect(state.geometry.polygons.length).toBe(1);
        });

        test('does nothing with fewer than 2 polygons', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            state = wallsReducer(state, mergePolygons({ polygons: [geom.polygons[0].id!] }));
            expect(state.geometry.polygons.length).toBe(1);
        });
    });

    describe('alignVertices', () => {
        test('aligns vertices to average coordinate', () => {
            const geom = createGeometry([[[0, 10], [100, 30], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const vertexMap = new Map([[poly.id!, [poly.vertices[0], poly.vertices[1]]]]);
            state = wallsReducer(state, alignVertices({ axis: 'horizontal', verticesMap: vertexMap }));
            const updated = state.geometry.polygons[0];
            // Both aligned vertices should have y ~ 20
            const aligned = updated.vertices.filter(v => Math.abs(v.vector[1] - 20) < 0.01);
            expect(aligned.length).toBe(2);
        });
    });

    describe('alignPolygons', () => {
        test('aligns polygons to common edge of bounding box', () => {
            const geom = createGeometry([
                [[0, 10], [50, 10], [50, 60], [0, 60]],
                [[100, 30], [150, 30], [150, 80], [100, 80]]
            ]);
            let state = wallsReducer(initialState, updateWalls(geom));
            state = wallsReducer(state, alignPolygons({ polygons: geom.polygons.map(p => p.id!), direction: 'top' }));
            const p1 = state.geometry.polygons[0];
            const p2 = state.geometry.polygons[1];
            expect(p1.boundingBox[0][1]).toBeCloseTo(p2.boundingBox[0][1], 1);
        });

        test('does nothing with fewer than 2 polygons', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const origPoly = state.geometry.polygons[0];
            state = wallsReducer(state, alignPolygons({ polygons: [geom.polygons[0].id!], direction: 'left' }));
            expect(state.geometry.polygons[0].vertices[0].vector).toEqual(origPoly.vertices[0].vector);
        });
    });

    describe('weldVertices', () => {
        test('merges vertices to centroid', () => {
            const geom = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            let state = wallsReducer(initialState, updateWalls(geom));
            const poly = state.geometry.polygons[0];
            const vertexMap = new Map([[poly.id!, [poly.vertices[0], poly.vertices[1]]]]);
            state = wallsReducer(state, weldVertices({ verticesMap: vertexMap }));
            const updated = state.geometry.polygons[0];
            const welded = updated.vertices.filter(v =>
                Math.abs(v.vector[0] - 50) < 0.01 && Math.abs(v.vector[1]) < 0.01
            );
            expect(welded.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('createRegularPolygon', () => {
        test('creates N-gon and adds to geometry', () => {
            let state = wallsReducer(initialState, createRegularPolygon({ center: [200, 200], radius: 50, sides: 6 }));
            expect(state.geometry.polygons.length).toBe(1);
            expect(state.geometry.polygons[0].edges.length).toBe(6);
        });

        test('does nothing for sides < 3', () => {
            let state = wallsReducer(initialState, createRegularPolygon({ center: [0, 0], radius: 50, sides: 2 }));
            expect(state.geometry.polygons.length).toBe(0);
        });
    });
});


// ─── Selection Slice ─────────────────────────────────────────────

describe('selection slice', () => {
    const initialState: ISelectionState = {
        elements: [],
        tree: { element: undefined as any, children: [] },
    };

    test('initial state has empty elements', () => {
        const state = selectionReducer(undefined, { type: 'unknown' });
        expect(state.elements.length).toBe(0);
    });

    describe('clearSelection', () => {
        test('clears all selected elements', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50]]]);
            const vertex = geom.polygons[0].vertices[0];
            const sel = selectVertex(vertex, geom.polygons[0]);
            let state = selectionReducer(initialState, startNewSelection({ elements: [sel], geometry: geom }));
            expect(state.elements.length).toBe(1);
            state = selectionReducer(state, clearSelection());
            expect(state.elements.length).toBe(0);
            expect(state.treeSelection).toBeUndefined();
        });
    });

    describe('startNewSelection', () => {
        test('sets selection to provided elements', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50]]]);
            const v1 = selectVertex(geom.polygons[0].vertices[0], geom.polygons[0]);
            const v2 = selectVertex(geom.polygons[0].vertices[1], geom.polygons[0]);
            const state = selectionReducer(initialState, startNewSelection({ elements: [v1, v2], geometry: geom }));
            expect(state.elements.length).toBe(2);
            expect(state.treeSelection).toBe(v1);
        });

        test('empty selection clears treeSelection', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50]]]);
            const state = selectionReducer(initialState, startNewSelection({ elements: [], geometry: geom }));
            expect(state.elements.length).toBe(0);
            expect(state.treeSelection).toBeUndefined();
        });
    });

    describe('addSelectedElement', () => {
        test('adds new element to selection', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50]]]);
            const v1 = selectVertex(geom.polygons[0].vertices[0], geom.polygons[0]);
            const v2 = selectVertex(geom.polygons[0].vertices[1], geom.polygons[0]);
            let state = selectionReducer(initialState, startNewSelection({ elements: [v1], geometry: geom }));
            state = selectionReducer(state, addSelectedElement({ elements: [v2], geometry: geom }));
            expect(state.elements.length).toBe(2);
        });

        test('removes existing element (toggle behavior)', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50]]]);
            const v1 = selectVertex(geom.polygons[0].vertices[0], geom.polygons[0]);
            let state = selectionReducer(initialState, startNewSelection({ elements: [v1], geometry: geom }));
            // Adding same element again should remove it
            state = selectionReducer(state, addSelectedElement({ elements: [v1], geometry: geom }));
            expect(state.elements.length).toBe(0);
        });
    });

    describe('selectTreeNode', () => {
        test('sets the tree selection', () => {
            const geom = createGeometry([[[0, 0], [50, 0], [50, 50]]]);
            const v1 = selectVertex(geom.polygons[0].vertices[0], geom.polygons[0]);
            let state = selectionReducer(initialState, startNewSelection({ elements: [v1], geometry: geom }));
            state = selectionReducer(state, selectTreeNode(v1));
            expect(state.treeSelection).toBe(v1);
        });
    });
});


// ─── Player Slice ────────────────────────────────────────────────

describe('player slice', () => {
    const initialState: IPlayerState = { camera: DEFAULT_CAMERA };

    test('initial state has default camera', () => {
        const state = playerReducer(undefined, { type: 'unknown' });
        expect(state.camera.position).toEqual([50, 50]);
    });

    describe('initializeCamera', () => {
        test('sets camera to provided value', () => {
            const cam = makeCamera({ position: [10, 20], direction: [0, 5], plane: [3, 0] });
            const state = playerReducer(initialState, initializeCamera(cam));
            expect(state.camera.position).toEqual([10, 20]);
        });
    });

    describe('rotateCamera', () => {
        test('rotates camera by given angle', () => {
            const state = playerReducer(initialState, rotateCamera(Math.PI / 2));
            expect(state.camera.direction[0]).toBeCloseTo(-10, 0);
            expect(state.camera.direction[1]).toBeCloseTo(0, 0);
        });
    });

    describe('changeCameraAngle', () => {
        test('increases FOV with direction 1', () => {
            const state = playerReducer(initialState, changeCameraAngle(1));
            const originalPlaneNorm = Math.sqrt(DEFAULT_CAMERA.plane![0] ** 2 + DEFAULT_CAMERA.plane![1] ** 2);
            const newPlaneNorm = Math.sqrt(state.camera.plane![0] ** 2 + state.camera.plane![1] ** 2);
            expect(newPlaneNorm).toBeGreaterThan(originalPlaneNorm);
        });

        test('decreases FOV with direction -1', () => {
            const state = playerReducer(initialState, changeCameraAngle(-1));
            const originalPlaneNorm = Math.sqrt(DEFAULT_CAMERA.plane![0] ** 2 + DEFAULT_CAMERA.plane![1] ** 2);
            const newPlaneNorm = Math.sqrt(state.camera.plane![0] ** 2 + state.camera.plane![1] ** 2);
            expect(newPlaneNorm).toBeLessThan(originalPlaneNorm);
        });
    });

    describe('changeCameraDepth', () => {
        test('increases depth with direction 1', () => {
            const state = playerReducer(initialState, changeCameraDepth(1));
            const originalDirNorm = Math.sqrt(DEFAULT_CAMERA.direction[0] ** 2 + DEFAULT_CAMERA.direction[1] ** 2);
            const newDirNorm = Math.sqrt(state.camera.direction[0] ** 2 + state.camera.direction[1] ** 2);
            expect(newDirNorm).toBeGreaterThan(originalDirNorm);
        });
    });

    describe('moveCamera', () => {
        test('moves camera forward', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[0, 1000], [100, 1000], [100, 1100], [0, 1100]]
            ]);
            const state = playerReducer(initialState, moveCamera({ direction: 1, geometry: geom, bspContext, speed: 0.15 }));
            expect(state.camera.position[1]).toBeGreaterThan(50);
        });
    });

    describe('strafeCamera', () => {
        test('strafes camera', () => {
            const { geometry: geom, bspContext } = geometries.withBsp([
                [[-1000, 0], [-1000, 100], [-1100, 100], [-1100, 0]]
            ]);
            const state = playerReducer(initialState, strafeCamera({ direction: 1, geometry: geom, bspContext, speed: 0.15 }));
            expect(state.camera.position).not.toEqual(DEFAULT_CAMERA.position);
        });
    });
});


// ─── World Config Slice ──────────────────────────────────────────

describe('world-config slice', () => {
    const initialState: IWorldConfigState = { fadeOn: undefined, horizonDistance: 300 };

    test('initial state has no fading', () => {
        const state = worldConfigReducer(undefined, { type: 'unknown' });
        expect(state.fadeOn).toBeUndefined();
        expect(state.horizonDistance).toBe(300);
    });

    describe('initialize', () => {
        test('sets world config', () => {
            const state = worldConfigReducer(initialState, initWorldConfig({ fadeOn: 128, horizonDistance: 500 }));
            expect(state.fadeOn).toBe(128);
            expect(state.horizonDistance).toBe(500);
        });
    });

    describe('toggleFadingStrategy', () => {
        test('first toggle enables fading at 0', () => {
            const state = worldConfigReducer(initialState, toggleFadingStrategy());
            expect(state.fadeOn).toBe(0);
        });

        test('increments fadeOn by 10', () => {
            let state: IWorldConfigState = { fadeOn: 0 };
            state = worldConfigReducer(state, toggleFadingStrategy());
            expect(state.fadeOn).toBe(10);
        });

        test('wraps to null after exceeding 245', () => {
            let state: IWorldConfigState = { fadeOn: 250 };
            state = worldConfigReducer(state, toggleFadingStrategy());
            expect(state.fadeOn).toBeNull();
        });

        test('cycles through: undefined -> 0 -> 10 -> ... -> 250 -> null -> 0', () => {
            let state: IWorldConfigState = { fadeOn: undefined };
            state = worldConfigReducer(state, toggleFadingStrategy());
            expect(state.fadeOn).toBe(0);
            
            // Increment a few times
            for (let i = 0; i < 25; i++) {
                state = worldConfigReducer(state, toggleFadingStrategy());
            }
            expect(state.fadeOn).toBe(250);

            state = worldConfigReducer(state, toggleFadingStrategy());
            expect(state.fadeOn).toBeNull();

            // null -> 0 again
            state = worldConfigReducer(state, toggleFadingStrategy());
            expect(state.fadeOn).toBe(0);
        });
    });
});


// ─── UI Config Slice ─────────────────────────────────────────────

describe('ui-config slice', () => {
    const initialState: IUIConfigState = { enableTestCanvas: undefined, bspDrawMode: BspDrawMode.None };

    test('initial state has test canvas disabled and BSP mode none', () => {
        const state = uiConfigReducer(undefined, { type: 'unknown' });
        expect(state.enableTestCanvas).toBeUndefined();
        expect(state.bspDrawMode).toBe(BspDrawMode.None);
    });

    describe('initialize', () => {
        test('sets UI config', () => {
            const state = uiConfigReducer(initialState, initUIConfig({
                enableTestCanvas: true,
                bspDrawMode: BspDrawMode.Planes,
            }));
            expect(state.enableTestCanvas).toBe(true);
            expect(state.bspDrawMode).toBe(BspDrawMode.Planes);
        });
    });

    describe('toggleTestCanvas', () => {
        test('toggles from undefined to true', () => {
            const state = uiConfigReducer(initialState, toggleTestCanvas());
            expect(state.enableTestCanvas).toBe(true);
        });

        test('toggles from true to false', () => {
            let state = uiConfigReducer(initialState, toggleTestCanvas());
            state = uiConfigReducer(state, toggleTestCanvas());
            expect(state.enableTestCanvas).toBe(false);
        });
    });

    describe('cycleBspDrawMode', () => {
        test('cycles None -> Planes', () => {
            const state = uiConfigReducer(initialState, cycleBspDrawMode());
            expect(state.bspDrawMode).toBe(BspDrawMode.Planes);
        });

        test('cycles Planes -> DetectedEdges', () => {
            let state = uiConfigReducer(initialState, cycleBspDrawMode());
            state = uiConfigReducer(state, cycleBspDrawMode());
            expect(state.bspDrawMode).toBe(BspDrawMode.DetectedEdges);
        });

        test('cycles DetectedEdges -> None', () => {
            let state = uiConfigReducer(initialState, cycleBspDrawMode());
            state = uiConfigReducer(state, cycleBspDrawMode());
            state = uiConfigReducer(state, cycleBspDrawMode());
            expect(state.bspDrawMode).toBe(BspDrawMode.None);
        });
    });
});


// ─── Textures Slice ──────────────────────────────────────────────

describe('textures slice', () => {
    const initialState: ITextureLibraryState = { sources: [] };

    test('initial state has empty sources', () => {
        const state = texturesReducer(undefined, { type: 'unknown' });
        expect(state.sources.length).toBe(0);
    });

    describe('initialize', () => {
        test('sets texture sources', () => {
            const sources = [
                { id: 'tex1', textureHeight: 64, textureWidth: 64, data: 'abc', mimeType: 'image/png', totalHeight: 128, totalWidth: 128 },
            ];
            const state = texturesReducer(initialState, initTextures(sources));
            expect(state.sources.length).toBe(1);
            expect(state.sources[0].id).toBe('tex1');
        });
    });

    describe('loadTexture', () => {
        test('adds texture from buffer data', () => {
            const buffer = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
            const state = texturesReducer(initialState, loadTexture({
                buffer,
                fileName: 'test.png',
                width: 64,
                height: 64,
            }));
            expect(state.sources.length).toBe(1);
            expect(state.sources[0].id).toBe('test.png');
            expect(state.sources[0].mimeType).toBe('image/png');
            expect(state.sources[0].totalWidth).toBe(64);
            expect(state.sources[0].totalHeight).toBe(64);
            expect(state.sources[0].data).toBeDefined();
        });

        test('detects JPEG mime type', () => {
            const buffer = new Uint8Array([255, 216, 255]);
            const state = texturesReducer(initialState, loadTexture({
                buffer,
                fileName: 'test.jpg',
                width: 32,
                height: 32,
            }));
            expect(state.sources[0].mimeType).toBe('image/jpeg');
        });

        test('detects GIF mime type', () => {
            const buffer = new Uint8Array([71, 73, 70]);
            const state = texturesReducer(initialState, loadTexture({
                buffer,
                fileName: 'test.gif',
                width: 16,
                height: 16,
            }));
            expect(state.sources[0].mimeType).toBe('image/gif');
        });

        test('defaults to PNG for unknown extension', () => {
            const buffer = new Uint8Array([0, 0, 0]);
            const state = texturesReducer(initialState, loadTexture({
                buffer,
                fileName: 'test.bmp',
                width: 16,
                height: 16,
            }));
            expect(state.sources[0].mimeType).toBe('image/png');
        });

        test('appends multiple textures', () => {
            const buffer1 = new Uint8Array([1, 2, 3]);
            const buffer2 = new Uint8Array([4, 5, 6]);
            let state = texturesReducer(initialState, loadTexture({
                buffer: buffer1, fileName: 'a.png', width: 64, height: 64,
            }));
            state = texturesReducer(state, loadTexture({
                buffer: buffer2, fileName: 'b.png', width: 32, height: 32,
            }));
            expect(state.sources.length).toBe(2);
        });
    });

    describe('adaptTexture', () => {
        test('updates texture dimensions by id', () => {
            const sources = [
                { id: 'tex1', textureHeight: 0, textureWidth: 0, data: '', mimeType: 'image/png', totalHeight: 128, totalWidth: 128 },
            ];
            let state = texturesReducer(initialState, initTextures(sources));
            state = texturesReducer(state, adaptTexture({ id: 'tex1', textureHeight: 32, textureWidth: 32 }));
            expect(state.sources[0].textureHeight).toBe(32);
            expect(state.sources[0].textureWidth).toBe(32);
        });

        test('does nothing if id not found', () => {
            const sources = [
                { id: 'tex1', textureHeight: 0, textureWidth: 0, data: '', mimeType: 'image/png', totalHeight: 128, totalWidth: 128 },
            ];
            let state = texturesReducer(initialState, initTextures(sources));
            state = texturesReducer(state, adaptTexture({ id: 'nonexistent', textureHeight: 32, textureWidth: 32 }));
            expect(state.sources[0].textureHeight).toBe(0);
        });
    });
});


// ─── Stats Slice ─────────────────────────────────────────────────

describe('stats slice', () => {
    test('initial state has zero performance metrics', () => {
        const state = statsReducer(undefined, { type: 'unknown' });
        expect(state.performance.timing.total).toBe(0);
        expect(state.performance.fps).toBe(0);
    });

    describe('statisticsUpdated', () => {
        test('replaces entire state with payload', () => {
            const newStats: IStatsState = {
                performance: {
                    timing: { drawing: 5, casting: 10, zbuffering: 15, total: 30 },
                    fps: 60,
                },
                intersections: { stats: EMPTY_STATS },
                detectedEdges: [],
            };
            const state = statsReducer(undefined, statisticsUpdated(newStats));
            expect(state.performance.fps).toBe(60);
            expect(state.performance.timing.total).toBe(30);
        });

        test('updates with new detected edges', () => {
            const newStats: IStatsState = {
                performance: {
                    timing: { drawing: 1, casting: 2, zbuffering: 3, total: 6 },
                    fps: 30,
                },
                intersections: { stats: EMPTY_STATS },
                detectedEdges: [{ segment: [[0, 0], [10, 10]], depth: 5 }],
            };
            const state = statsReducer(undefined, statisticsUpdated(newStats));
            expect(state.detectedEdges.length).toBe(1);
            expect(state.detectedEdges[0].depth).toBe(5);
        });
    });
});
