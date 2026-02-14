import { findClosest, walk } from './querying';
import { createLeaf, createNode, NULL_NODE, IBSPNode, LeafBspNode, SplitBspNode } from './model';
import { createPolygon, IPolygon } from '../polygon';
import { buildBspTree } from './creation';
import { createGeometry } from '../geometry';
import { Plane } from '../../math/plane';
import { resetTestRandom } from '../../testing/factories';

beforeEach(() => resetTestRandom());

const makePolygon = (verts: [number, number][]): IPolygon => createPolygon(verts);

describe('findClosest', () => {
    test('returns leaf node when tree is a leaf', () => {
        const poly = makePolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
        const leaf = createLeaf([poly]);
        const result = findClosest(leaf, [5, 5]);
        expect(result).toBe(leaf);
    });

    test('returns undefined for null node', () => {
        const result = findClosest(NULL_NODE, [5, 5]);
        expect(result).toBeUndefined();
    });

    test('traverses to front child when point is in front of split plane', () => {
        const frontPoly = makePolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
        const backPoly = makePolygon([[100, 0], [110, 0], [110, 10], [100, 10]]);
        const frontLeaf = createLeaf([frontPoly]);
        const backLeaf = createLeaf([backPoly]);
        // Plane with normal [1, 0] at d=50 — points with x > 50 are in front
        const plane: Plane = { n: [1, 0], d: 50 };
        const tree = createNode(plane, frontLeaf, backLeaf, []);
        // Point at x=60 is in front of the plane
        const result = findClosest(tree as IBSPNode, [60, 5]);
        expect(result).toBe(frontLeaf);
    });

    test('traverses to back child when point is behind split plane', () => {
        const frontPoly = makePolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
        const backPoly = makePolygon([[100, 0], [110, 0], [110, 10], [100, 10]]);
        const frontLeaf = createLeaf([frontPoly]);
        const backLeaf = createLeaf([backPoly]);
        const plane: Plane = { n: [1, 0], d: 50 };
        const tree = createNode(plane, frontLeaf, backLeaf, []);
        // Point at x=10 is behind the plane
        const result = findClosest(tree as IBSPNode, [10, 5]);
        expect(result).toBe(backLeaf);
    });

    test('works with real BSP tree from geometry', () => {
        const geom = createGeometry([
            [[0, 0], [50, 0], [50, 50], [0, 50]],
            [[200, 200], [250, 200], [250, 250], [200, 250]],
        ]);
        const bsp = buildBspTree(geom.polygons);
        const result = findClosest(bsp, [25, 25]);
        expect(result).toBeDefined();
        expect((result as LeafBspNode).type).toBe('leaf');
    });
});

describe('walk', () => {
    test('calls map with leaf polygons and returns its result', () => {
        const poly = makePolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
        const leaf = createLeaf([poly]);
        const visited: IPolygon[][] = [];
        const result = walk(leaf, [5, 5], (polygons) => {
            visited.push(polygons);
            return true;
        });
        expect(result).toBe(true);
        expect(visited.length).toBe(1);
        expect(visited[0]).toEqual([poly]);
    });

    test('returns true for null node', () => {
        const result = walk(NULL_NODE, [5, 5], () => false);
        expect(result).toBe(true);
    });

    test('visits nodes in front-to-back order for split tree', () => {
        const frontPoly = makePolygon([[60, 0], [70, 0], [70, 10], [60, 10]]);
        const backPoly = makePolygon([[10, 0], [20, 0], [20, 10], [10, 10]]);
        const coplanarPoly = makePolygon([[49, 0], [51, 0], [51, 10], [49, 10]]);
        const frontLeaf = createLeaf([frontPoly]);
        const backLeaf = createLeaf([backPoly]);
        const plane: Plane = { n: [1, 0], d: 50 };
        const tree = createNode(plane, frontLeaf, backLeaf, [coplanarPoly]);

        const visited: IPolygon[][] = [];
        // Point at x=60 is in front of the plane, so front is visited first
        walk(tree as IBSPNode, [60, 5], (polygons) => {
            visited.push(polygons);
            return true;
        });
        // Order: nearest (front), coplanar, farthest (back)
        expect(visited.length).toBe(3);
        expect(visited[0]).toEqual([frontPoly]);
        expect(visited[1]).toEqual([coplanarPoly]);
        expect(visited[2]).toEqual([backPoly]);
    });

    test('stops early when map returns false', () => {
        const frontPoly = makePolygon([[60, 0], [70, 0], [70, 10], [60, 10]]);
        const backPoly = makePolygon([[10, 0], [20, 0], [20, 10], [10, 10]]);
        const frontLeaf = createLeaf([frontPoly]);
        const backLeaf = createLeaf([backPoly]);
        const plane: Plane = { n: [1, 0], d: 50 };
        const tree = createNode(plane, frontLeaf, backLeaf, []);

        const visited: IPolygon[][] = [];
        const result = walk(tree as IBSPNode, [60, 5], (polygons) => {
            visited.push(polygons);
            return false; // stop after first
        });
        expect(result).toBe(false);
        expect(visited.length).toBe(1); // only front visited
    });

    test('works with real BSP tree', () => {
        const geom = createGeometry([
            [[0, 0], [50, 0], [50, 50], [0, 50]],
            [[100, 100], [150, 100], [150, 150], [100, 150]],
        ]);
        const bsp = buildBspTree(geom.polygons);
        const visited: IPolygon[][] = [];
        walk(bsp, [25, 25], (polygons) => {
            visited.push(polygons);
            return true;
        });
        expect(visited.length).toBeGreaterThan(0);
    });
});
