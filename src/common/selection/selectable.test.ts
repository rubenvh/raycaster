import {
    selectVertex, selectEdge, selectPolygon,
    isVertex, isEdge, isPolygon,
    selectedId, isSelected, findSelectedIndex,
    isSelectedVertex, isSelectedEdge, isSelectedPolygon,
    isCloseToSelected, selectedElement, createVertexMap,
    SelectableElement, SelectedVertex, SelectedEdge, SelectedPolygon,
} from './selectable';
import { createGeometry } from '../geometry/geometry';
import { makeVertex } from '../geometry/vertex';
import { VertexCollision, EdgeCollision } from '../geometry/collision';

// ─── Factory Helpers ─────────────────────────────────────────────

const makeGeom = () => createGeometry([
    [[0, 0], [100, 0], [100, 100], [0, 100]],
    [[200, 200], [300, 200], [300, 300]],
]);

// ─── Type Guards ─────────────────────────────────────────────────

describe('type guards', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('isVertex returns true for SelectedVertex', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        expect(isVertex(sv)).toBe(true);
        expect(isEdge(sv)).toBe(false);
        expect(isPolygon(sv)).toBe(false);
    });

    test('isEdge returns true for SelectedEdge', () => {
        const se = selectEdge(poly.edges[0], poly);
        expect(isEdge(se)).toBe(true);
        expect(isVertex(se)).toBe(false);
        expect(isPolygon(se)).toBe(false);
    });

    test('isPolygon returns true for SelectedPolygon', () => {
        const sp = selectPolygon(poly);
        expect(isPolygon(sp)).toBe(true);
        expect(isVertex(sp)).toBe(false);
        expect(isEdge(sp)).toBe(false);
    });
});

// ─── selectVertex / selectEdge / selectPolygon ───────────────────

describe('select constructors', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('selectVertex creates SelectedVertex', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        expect(sv.kind).toBe('vertex');
        expect(sv.vertex).toBe(poly.vertices[0]);
        expect(sv.polygon).toBe(poly);
    });

    test('selectEdge creates SelectedEdge', () => {
        const se = selectEdge(poly.edges[0], poly);
        expect(se.kind).toBe('edge');
        expect(se.edge).toBe(poly.edges[0]);
        expect(se.polygon).toBe(poly);
    });

    test('selectPolygon creates SelectedPolygon', () => {
        const sp = selectPolygon(poly);
        expect(sp.kind).toBe('polygon');
        expect(sp.polygon).toBe(poly);
    });
});

// ─── selectedId ──────────────────────────────────────────────────

describe('selectedId', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('returns vertex id for SelectedVertex', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        expect(selectedId(sv)).toBe(poly.vertices[0].id);
    });

    test('returns edge id for SelectedEdge', () => {
        const se = selectEdge(poly.edges[0], poly);
        expect(selectedId(se)).toBe(poly.edges[0].id);
    });

    test('returns polygon id for SelectedPolygon', () => {
        const sp = selectPolygon(poly);
        expect(selectedId(sp)).toBe(poly.id);
    });
});

// ─── isSelectedPolygon / isSelectedEdge / isSelectedVertex ───────

describe('isSelected* query functions', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('isSelectedPolygon finds matching polygon in selection', () => {
        const sp = selectPolygon(poly);
        expect(isSelectedPolygon(poly.id!, [sp])).toBe(true);
    });

    test('isSelectedPolygon returns false for non-matching', () => {
        const sp = selectPolygon(geom.polygons[1]);
        expect(isSelectedPolygon(poly.id!, [sp])).toBe(false);
    });

    test('isSelectedEdge finds matching edge in selection', () => {
        const se = selectEdge(poly.edges[0], poly);
        expect(isSelectedEdge(poly.edges[0].id!, [se])).toBe(true);
    });

    test('isSelectedEdge returns false for non-matching', () => {
        const se = selectEdge(poly.edges[1], poly);
        expect(isSelectedEdge(poly.edges[0].id!, [se])).toBe(false);
    });

    test('isSelectedVertex finds matching vertex in selection', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        expect(isSelectedVertex(poly.vertices[0].id!, [sv])).toBe(true);
    });

    test('isSelectedVertex returns false for non-matching', () => {
        const sv = selectVertex(poly.vertices[1], poly);
        expect(isSelectedVertex(poly.vertices[0].id!, [sv])).toBe(false);
    });

    test('returns false for empty selection', () => {
        expect(isSelectedPolygon(poly.id!, [])).toBe(false);
        expect(isSelectedEdge(poly.edges[0].id!, [])).toBe(false);
        expect(isSelectedVertex(poly.vertices[0].id!, [])).toBe(false);
    });
});

// ─── findSelectedIndex / isSelected ──────────────────────────────

describe('findSelectedIndex', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('finds polygon by id', () => {
        const sp = selectPolygon(poly);
        expect(findSelectedIndex(sp, [sp])).toBe(0);
    });

    test('finds vertex by id', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        expect(findSelectedIndex(sv, [sv])).toBe(0);
    });

    test('finds edge by id', () => {
        const se = selectEdge(poly.edges[0], poly);
        expect(findSelectedIndex(se, [se])).toBe(0);
    });

    test('returns -1 when not found', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        const se = selectEdge(poly.edges[0], poly);
        expect(findSelectedIndex(sv, [se])).toBe(-1);
    });

    test('finds element at correct index in mixed list', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        const se = selectEdge(poly.edges[0], poly);
        const sp = selectPolygon(poly);
        expect(findSelectedIndex(se, [sv, se, sp])).toBe(1);
        expect(findSelectedIndex(sp, [sv, se, sp])).toBe(2);
    });
});

describe('isSelected', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('returns true when element exists', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        expect(isSelected(sv, [sv])).toBe(true);
    });

    test('returns false when element is absent', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        expect(isSelected(sv, [])).toBe(false);
    });
});

// ─── isCloseToSelected ──────────────────────────────────────────

describe('isCloseToSelected', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('vertex: close point returns true', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        // vertex at [0,0], test with [1,1] which is ~1.4 away (< epsilon=5)
        expect(isCloseToSelected([1, 1], sv)).toBe(true);
    });

    test('vertex: far point returns false', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        // vertex at [0,0], test with [50,50]
        expect(isCloseToSelected([50, 50], sv)).toBe(false);
    });

    test('edge: close point returns true', () => {
        const se = selectEdge(poly.edges[0], poly);
        // edge from [0,0] to [100,0], point [50,1] is ~1 away
        expect(isCloseToSelected([50, 1], se)).toBe(true);
    });

    test('edge: far point returns false', () => {
        const se = selectEdge(poly.edges[0], poly);
        expect(isCloseToSelected([50, 50], se)).toBe(false);
    });

    test('polygon: close to any edge returns true', () => {
        const sp = selectPolygon(poly);
        // close to bottom edge [0,0]->[100,0]
        expect(isCloseToSelected([50, 1], sp)).toBe(true);
    });

    test('polygon: far from all edges returns false', () => {
        const sp = selectPolygon(poly);
        // center of polygon, far from edges
        expect(isCloseToSelected([50, 50], sp)).toBe(false);
    });
});

// ─── selectedElement ─────────────────────────────────────────────

describe('selectedElement', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('returns null for null collision', () => {
        expect(selectedElement(null as any, false)).toBeNull();
    });

    test('returns SelectedPolygon when selectPolygon is true', () => {
        const collision: VertexCollision = {
            polygon: poly,
            vertex: poly.vertices[0],
            distance: 5,
            kind: 'vertex',
        };
        const result = selectedElement(collision, true);
        expect(result.kind).toBe('polygon');
        expect((result as SelectedPolygon).polygon).toBe(poly);
    });

    test('returns SelectedVertex for vertex collision when selectPolygon is false', () => {
        const collision: VertexCollision = {
            polygon: poly,
            vertex: poly.vertices[0],
            distance: 5,
            kind: 'vertex',
        };
        const result = selectedElement(collision, false);
        expect(result.kind).toBe('vertex');
        expect((result as SelectedVertex).vertex).toBe(poly.vertices[0]);
        expect((result as SelectedVertex).polygon).toBe(poly);
    });

    test('returns SelectedEdge for edge collision when selectPolygon is false', () => {
        const collision: EdgeCollision = {
            polygon: poly,
            edge: poly.edges[0],
            distance: 3,
            kind: 'edge',
        };
        const result = selectedElement(collision, false);
        expect(result.kind).toBe('edge');
        expect((result as SelectedEdge).edge).toBe(poly.edges[0]);
        expect((result as SelectedEdge).polygon).toBe(poly);
    });
});

// ─── createVertexMap ─────────────────────────────────────────────

describe('createVertexMap', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];

    test('maps polygon selection to all polygon vertices', () => {
        const sp = selectPolygon(poly);
        const map = createVertexMap([sp]);
        expect(map.get(poly.id!)).toBeDefined();
        expect(map.get(poly.id!)!.length).toBe(poly.vertices.length);
    });

    test('maps vertex selection to single vertex', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        const map = createVertexMap([sv]);
        expect(map.get(poly.id!)!.length).toBe(1);
        expect(map.get(poly.id!)![0]).toBe(poly.vertices[0]);
    });

    test('maps edge selection to start and end vertices', () => {
        const se = selectEdge(poly.edges[0], poly);
        const map = createVertexMap([se]);
        expect(map.get(poly.id!)!.length).toBe(2);
    });

    test('deduplicates vertices for same polygon', () => {
        // Select two edges sharing a vertex
        const se1 = selectEdge(poly.edges[0], poly);
        const se2 = selectEdge(poly.edges[1], poly);
        const map = createVertexMap([se1, se2]);
        // edges[0] has start/end, edges[1] has start/end, they share one vertex
        // Set deduplicates, so should be 3, not 4
        expect(map.get(poly.id!)!.length).toBe(3);
    });

    test('groups by polygon id across different polygons', () => {
        const poly2 = geom.polygons[1];
        const sv1 = selectVertex(poly.vertices[0], poly);
        const sv2 = selectVertex(poly2.vertices[0], poly2);
        const map = createVertexMap([sv1, sv2]);
        expect(map.size).toBe(2);
        expect(map.get(poly.id!)!.length).toBe(1);
        expect(map.get(poly2.id!)!.length).toBe(1);
    });

    test('returns empty map for empty selection', () => {
        const map = createVertexMap([]);
        expect(map.size).toBe(0);
    });
});
