import { buildSelectionTree, ISelectionTreeNode } from './selection-tree';
import { selectVertex, selectEdge, selectPolygon, isVertex, isEdge, isPolygon, SelectableElement } from './selectable';
import { createGeometry } from '../geometry/geometry';

const makeGeom = () => createGeometry([
    [[0, 0], [100, 0], [100, 100], [0, 100]],
    [[200, 200], [300, 200], [300, 300]],
]);

const countNodes = (node: ISelectionTreeNode): number => {
    return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
};

const collectKinds = (node: ISelectionTreeNode): string[] => {
    const result: string[] = [];
    if (node.element) result.push(node.element.kind);
    for (const child of node.children) {
        result.push(...collectKinds(child));
    }
    return result;
};

describe('buildSelectionTree', () => {
    const geom = makeGeom();
    const poly = geom.polygons[0];
    const poly2 = geom.polygons[1];

    test('returns root with undefined element for empty selection', () => {
        const tree = buildSelectionTree([], geom);
        expect(tree.element).toBeUndefined();
        expect(tree.children.length).toBe(0);
    });

    test('root element is always undefined', () => {
        const sv = selectVertex(poly.vertices[0], poly);
        const tree = buildSelectionTree([sv], geom);
        expect(tree.element).toBeUndefined();
    });

    // ─── Polygon selection (top-down branch) ────────────

    describe('polygon selection (top-down)', () => {
        test('creates branch with polygon -> edges -> vertices', () => {
            const sp = selectPolygon(poly);
            const tree = buildSelectionTree([sp], geom);
            expect(tree.children.length).toBe(1);

            const polyNode = tree.children[0];
            expect(isPolygon(polyNode.element)).toBe(true);
            // polygon with 4 edges should have 4 edge children
            expect(polyNode.children.length).toBe(poly.edges.length);

            // Each edge child should have 2 vertex children (start, end)
            for (const edgeNode of polyNode.children) {
                expect(isEdge(edgeNode.element)).toBe(true);
                expect(edgeNode.children.length).toBe(2);
                for (const vertexNode of edgeNode.children) {
                    expect(isVertex(vertexNode.element)).toBe(true);
                    expect(vertexNode.children.length).toBe(0);
                }
            }
        });

        test('triangle polygon has 3 edge children', () => {
            const sp = selectPolygon(poly2);
            const tree = buildSelectionTree([sp], geom);
            const polyNode = tree.children[0];
            expect(polyNode.children.length).toBe(3);
        });
    });

    // ─── Edge selection (edge branch) ───────────────────

    describe('edge selection', () => {
        test('creates branch with edge -> [polygon, vertex start, vertex end]', () => {
            const se = selectEdge(poly.edges[0], poly);
            const tree = buildSelectionTree([se], geom);
            expect(tree.children.length).toBe(1);

            const edgeNode = tree.children[0];
            expect(isEdge(edgeNode.element)).toBe(true);
            expect(edgeNode.children.length).toBe(3); // polygon + 2 vertices

            // First child should be the parent polygon (top-down)
            const polyChild = edgeNode.children[0];
            expect(isPolygon(polyChild.element)).toBe(true);

            // Other children are vertex bottom-up branches
            const vertexChild1 = edgeNode.children[1];
            const vertexChild2 = edgeNode.children[2];
            expect(isVertex(vertexChild1.element)).toBe(true);
            expect(isVertex(vertexChild2.element)).toBe(true);
        });
    });

    // ─── Vertex selection (bottom-up branch) ────────────

    describe('vertex selection (bottom-up)', () => {
        test('creates branch with vertex -> [polygon, connected edges]', () => {
            const sv = selectVertex(poly.vertices[0], poly);
            const tree = buildSelectionTree([sv], geom);
            expect(tree.children.length).toBe(1);

            const vertexNode = tree.children[0];
            expect(isVertex(vertexNode.element)).toBe(true);
            // Bottom-up: should have children for parent polygon + connected edges
            expect(vertexNode.children.length).toBeGreaterThanOrEqual(2);

            // First child is the polygon
            const polyChild = vertexNode.children[0];
            expect(isPolygon(polyChild.element)).toBe(true);

            // Remaining children are edges connected to the vertex
            for (let i = 1; i < vertexNode.children.length; i++) {
                expect(isEdge(vertexNode.children[i].element)).toBe(true);
            }
        });

        test('vertex connected to 2 edges in quadrilateral has 3 children (1 polygon + 2 edges)', () => {
            const sv = selectVertex(poly.vertices[0], poly);
            const tree = buildSelectionTree([sv], geom);
            const vertexNode = tree.children[0];
            // vertex[0] connects to edge[0] (start) and edge[3] (end for quad)
            expect(vertexNode.children.length).toBe(3);
        });
    });

    // ─── Multiple selections ────────────────────────────

    describe('multiple selections', () => {
        test('builds separate branches per selection', () => {
            const sv = selectVertex(poly.vertices[0], poly);
            const se = selectEdge(poly.edges[1], poly);
            const tree = buildSelectionTree([sv, se], geom);
            expect(tree.children.length).toBe(2);
        });

        test('builds branches across different polygons', () => {
            const sp1 = selectPolygon(poly);
            const sp2 = selectPolygon(poly2);
            const tree = buildSelectionTree([sp1, sp2], geom);
            expect(tree.children.length).toBe(2);
        });
    });
});
