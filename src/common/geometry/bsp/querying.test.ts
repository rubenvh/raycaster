import { findClosest, isAABBBehindPlane, isAABBInFrontOfPlane, isAABBOutsideFrustum, walk, walkWithFrustum, FrustumPlanes } from './querying';
import { createLeaf, createNode, NULL_NODE, IBSPNode, LeafBspNode, SplitBspNode, recomputeBspBounds } from './model';
import { createPolygon, IPolygon, BoundingBox } from '../polygon';
import { buildBspTree } from './creation';
import { createGeometry } from '../geometry';
import { Plane } from '../../math/plane';
import { resetTestRandom } from '../../testing/factories';
import { makeCamera } from '../../camera';

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

// ============================================================================
// AABB Frustum Culling Tests
// ============================================================================

describe('isAABBBehindPlane', () => {
    // Plane with normal [0, 1] at d=10 — points with y > 10 are "in front"
    const plane: Plane = { n: [0, 1], d: 10 };

    test('returns true when AABB is entirely behind the plane', () => {
        const bounds: BoundingBox = [[0, 0], [5, 8]]; // max y=8 < 10
        expect(isAABBBehindPlane(bounds, plane)).toBe(true);
    });

    test('returns false when AABB is entirely in front of the plane', () => {
        const bounds: BoundingBox = [[0, 12], [5, 20]]; // min y=12 > 10
        expect(isAABBBehindPlane(bounds, plane)).toBe(false);
    });

    test('returns false when AABB straddles the plane', () => {
        const bounds: BoundingBox = [[0, 5], [5, 15]]; // min y=5 < 10 < max y=15
        expect(isAABBBehindPlane(bounds, plane)).toBe(false);
    });

    test('returns false when AABB p-vertex is exactly on the plane', () => {
        // p-vertex for normal [0,1] is max-y = 10, so dot = 10 = d, not < d
        const bounds: BoundingBox = [[0, 5], [5, 10]];
        expect(isAABBBehindPlane(bounds, plane)).toBe(false);
    });

    test('works with diagonal plane normal', () => {
        // Plane with normal [1, 1] (not normalized) at d=20
        // dot(n, p) < 20 means x + y < 20 for the p-vertex
        const diag: Plane = { n: [1, 1], d: 20 };
        // AABB [0,0]-[5,5]: p-vertex is [5,5], dot = 10 < 20 → behind
        expect(isAABBBehindPlane([[0, 0], [5, 5]], diag)).toBe(true);
        // AABB [15,15]-[20,20]: p-vertex is [20,20], dot = 40 > 20 → not behind
        expect(isAABBBehindPlane([[15, 15], [20, 20]], diag)).toBe(false);
    });

    test('works with negative normal components', () => {
        // Plane with normal [-1, 0] at d=-10 → points with x < 10 are "in front"
        const negPlane: Plane = { n: [-1, 0], d: -10 };
        // AABB [12, 0]-[20, 5]: p-vertex for [-1,0] is [min-x=12], dot = -12 < -10 → behind
        expect(isAABBBehindPlane([[12, 0], [20, 5]], negPlane)).toBe(true);
        // AABB [0, 0]-[5, 5]: p-vertex for [-1,0] is [min-x=0], dot = 0 > -10 → not behind
        expect(isAABBBehindPlane([[0, 0], [5, 5]], negPlane)).toBe(false);
    });
});

describe('isAABBInFrontOfPlane', () => {
    const plane: Plane = { n: [0, 1], d: 10 };

    test('returns true when AABB is entirely in front of the plane', () => {
        const bounds: BoundingBox = [[0, 12], [5, 20]]; // min y=12 > 10
        expect(isAABBInFrontOfPlane(bounds, plane)).toBe(true);
    });

    test('returns false when AABB is entirely behind the plane', () => {
        const bounds: BoundingBox = [[0, 0], [5, 8]]; // max y=8 < 10
        expect(isAABBInFrontOfPlane(bounds, plane)).toBe(false);
    });

    test('returns false when AABB straddles the plane', () => {
        const bounds: BoundingBox = [[0, 5], [5, 15]];
        expect(isAABBInFrontOfPlane(bounds, plane)).toBe(false);
    });

    test('returns false when AABB n-vertex is exactly on the plane', () => {
        // n-vertex for normal [0,1] is min-y = 10, so dot = 10 = d, not > d
        const bounds: BoundingBox = [[0, 10], [5, 20]];
        expect(isAABBInFrontOfPlane(bounds, plane)).toBe(false);
    });

    test('works with diagonal plane normal', () => {
        const diag: Plane = { n: [1, 1], d: 20 };
        // AABB [15,15]-[20,20]: n-vertex is [15,15], dot = 30 > 20 → in front
        expect(isAABBInFrontOfPlane([[15, 15], [20, 20]], diag)).toBe(true);
        // AABB [0,0]-[5,5]: n-vertex is [0,0], dot = 0 < 20 → not in front
        expect(isAABBInFrontOfPlane([[0, 0], [5, 5]], diag)).toBe(false);
    });
});

describe('isAABBOutsideFrustum', () => {
    // Use the default camera to get realistic frustum planes
    // Default camera: position [50,50], direction [0,10], plane [15,0]
    const camera = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
    const frustum: FrustumPlanes = camera.planes;

    test('returns false for AABB directly in front of camera', () => {
        // AABB in front of camera, within FOV
        const bounds: BoundingBox = [[45, 55], [55, 65]];
        expect(isAABBOutsideFrustum(bounds, frustum)).toBe(false);
    });

    test('returns true for AABB behind camera', () => {
        // AABB fully behind the camera (y < 50 for a camera pointing +y)
        const bounds: BoundingBox = [[40, 10], [60, 40]];
        expect(isAABBOutsideFrustum(bounds, frustum)).toBe(true);
    });

    test('returns true for AABB far to the left of frustum', () => {
        // Camera is at [50,50] pointing +y with plane [15,0]
        // Left edge of view goes from [50,50] toward [35,60]
        // An AABB far to the left should be outside
        const bounds: BoundingBox = [[0, 55], [10, 65]];
        expect(isAABBOutsideFrustum(bounds, frustum)).toBe(true);
    });

    test('returns true for AABB far to the right of frustum', () => {
        // Right edge of view goes from [50,50] toward [65,60]
        // An AABB far to the right should be outside
        const bounds: BoundingBox = [[90, 55], [100, 65]];
        expect(isAABBOutsideFrustum(bounds, frustum)).toBe(true);
    });

    test('returns false for AABB that straddles the left edge', () => {
        // AABB that is partially inside and partially outside left boundary
        const bounds: BoundingBox = [[30, 55], [50, 70]];
        expect(isAABBOutsideFrustum(bounds, frustum)).toBe(false);
    });

    test('returns false for AABB that straddles the right edge', () => {
        const bounds: BoundingBox = [[50, 55], [70, 70]];
        expect(isAABBOutsideFrustum(bounds, frustum)).toBe(false);
    });

    test('returns false for large AABB that encompasses the entire frustum', () => {
        // A very large AABB that surrounds the camera and frustum
        const bounds: BoundingBox = [[0, 0], [100, 100]];
        expect(isAABBOutsideFrustum(bounds, frustum)).toBe(false);
    });
});

describe('walkWithFrustum', () => {
    const camera = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
    const frustum: FrustumPlanes = camera.planes;

    test('visits leaf polygons within frustum', () => {
        const poly = makePolygon([[45, 55], [55, 55], [55, 65], [45, 65]]);
        const leaf = createLeaf([poly]);
        const visited: IPolygon[][] = [];
        walkWithFrustum(leaf, [50, 50], frustum, (polygons) => {
            visited.push(polygons);
            return true;
        });
        expect(visited.length).toBe(1);
        expect(visited[0]).toEqual([poly]);
    });

    test('skips leaf node outside frustum', () => {
        // Polygon entirely behind camera
        const poly = makePolygon([[40, 10], [60, 10], [60, 20], [40, 20]]);
        const leaf = createLeaf([poly]);
        const visited: IPolygon[][] = [];
        walkWithFrustum(leaf, [50, 50], frustum, (polygons) => {
            visited.push(polygons);
            return true;
        });
        expect(visited.length).toBe(0);
    });

    test('returns true for null node', () => {
        const result = walkWithFrustum(NULL_NODE, [50, 50], frustum, () => false);
        expect(result).toBe(true);
    });

    test('culls subtrees outside frustum in split tree', () => {
        // Front poly: in front of camera, within FOV
        const frontPoly = makePolygon([[45, 55], [55, 55], [55, 65], [45, 65]]);
        // Back poly: behind camera, outside frustum
        const backPoly = makePolygon([[40, 10], [60, 10], [60, 20], [40, 20]]);
        const frontLeaf = createLeaf([frontPoly]);
        const backLeaf = createLeaf([backPoly]);
        const plane: Plane = { n: [0, 1], d: 50 };
        const tree = createNode(plane, frontLeaf, backLeaf, []);

        // Verify bounds are correct
        expect(isAABBOutsideFrustum((backLeaf as LeafBspNode).bounds, frustum)).toBe(true);

        const visited: IPolygon[][] = [];
        walkWithFrustum(tree as IBSPNode, [50, 55], frustum, (polygons) => {
            visited.push(polygons);
            return true;
        });
        // Only the front leaf should be visited; back is culled.
        // Note: the empty coplanar list also triggers a map() call.
        expect(visited.length).toBe(2); // front leaf + empty coplanar
        expect(visited[0]).toEqual([frontPoly]);
        expect(visited[1]).toEqual([]); // empty coplanar
    });

    test('produces same results as walk for geometry within frustum', () => {
        // Create a geometry that is entirely within the frustum
        const geom = createGeometry([
            [[45, 55], [48, 55], [48, 58], [45, 58]],
            [[52, 55], [55, 55], [55, 58], [52, 58]],
        ]);
        const bsp = buildBspTree(geom.polygons);

        const walkVisited: IPolygon[][] = [];
        walk(bsp, [50, 50], (polygons) => {
            walkVisited.push(polygons);
            return true;
        });

        const frustumVisited: IPolygon[][] = [];
        walkWithFrustum(bsp, [50, 50], frustum, (polygons) => {
            frustumVisited.push(polygons);
            return true;
        });

        // Both should visit the same polygons in the same order
        expect(frustumVisited.length).toBe(walkVisited.length);
        for (let i = 0; i < walkVisited.length; i++) {
            expect(frustumVisited[i]).toEqual(walkVisited[i]);
        }
    });
});

describe('BSP bounds JSON serialization', () => {
    /** Helper: check that all bounds in a BSP tree contain only finite numbers */
    function assertFiniteBounds(node: IBSPNode, path = 'root'): void {
        if (node.type === 'null') return;
        expect(node.bounds).not.toBeNull();
        if (node.bounds) {
            const [[minX, minY], [maxX, maxY]] = node.bounds;
            expect(Number.isFinite(minX)).toBe(true);
            expect(Number.isFinite(minY)).toBe(true);
            expect(Number.isFinite(maxX)).toBe(true);
            expect(Number.isFinite(maxY)).toBe(true);
        }
        if (node.type === 'split') {
            assertFiniteBounds(node.front, path + '.front');
            assertFiniteBounds(node.back, path + '.back');
        }
    }

    test('buildBspTree produces only finite bounds (no Infinity)', () => {
        const geom = createGeometry([
            [[0, 0], [50, 0], [50, 50], [0, 50]],
            [[60, 0], [110, 0], [110, 50], [60, 50]],
            [[0, 60], [50, 60], [50, 110], [0, 110]],
        ]);
        const bsp = buildBspTree(geom.polygons);
        assertFiniteBounds(bsp);
    });

    test('BSP bounds survive JSON roundtrip after fix', () => {
        const geom = createGeometry([
            [[0, 0], [50, 0], [50, 50], [0, 50]],
            [[60, 0], [110, 0], [110, 50], [60, 50]],
        ]);
        const bsp = buildBspTree(geom.polygons);
        assertFiniteBounds(bsp);

        // Simulate save/load cycle
        const serialized = JSON.stringify(bsp);
        const deserialized = JSON.parse(serialized);

        // Bounds should still be finite (no Infinity → null corruption)
        assertFiniteBounds(deserialized);
    });

    test('recomputeBspBounds fixes corrupted null bounds from old saves', () => {
        const geom = createGeometry([
            [[0, 0], [50, 0], [50, 50], [0, 50]],
            [[60, 0], [110, 0], [110, 50], [60, 50]],
            [[0, 60], [50, 60], [50, 110], [0, 110]],
        ]);
        const bsp = buildBspTree(geom.polygons);

        // Manually corrupt bounds to simulate old saved file with Infinity→null
        function corruptBounds(node: any): void {
            if (!node || node.type === 'null') return;
            if (node.bounds) {
                node.bounds = [[null, null], [null, null]];
            }
            if (node.type === 'split') {
                corruptBounds(node.front);
                corruptBounds(node.back);
            }
        }
        const corrupted = JSON.parse(JSON.stringify(bsp));
        corruptBounds(corrupted);

        // Verify it's actually corrupted
        if (corrupted.type !== 'null') {
            expect(corrupted.bounds).toEqual([[null, null], [null, null]]);
        }

        // Recompute should fix it
        const fixed = recomputeBspBounds(corrupted);
        assertFiniteBounds(fixed);
    });

    test('walkWithFrustum works correctly after JSON roundtrip', () => {
        const geom = createGeometry([
            [[0, 0], [100, 0], [100, 100], [0, 100]],
            [[200, 0], [300, 0], [300, 100], [200, 100]],
        ]);
        const bsp = buildBspTree(geom.polygons);

        // Camera looking up from (50, -20), should see both polygons
        const camera = makeCamera({ position: [150, -20], direction: [0, 10], plane: [200, 0] });
        const frustum = camera.planes;

        // Collect polygons from original BSP
        const originalVisited: IPolygon[][] = [];
        walkWithFrustum(bsp, camera.position, frustum, (polygons) => {
            originalVisited.push(polygons);
            return true;
        });

        // Simulate save/load cycle with recomputeBspBounds
        const deserialized = JSON.parse(JSON.stringify(bsp));
        const restored = recomputeBspBounds(deserialized);

        // Collect polygons from restored BSP
        const restoredVisited: IPolygon[][] = [];
        walkWithFrustum(restored, camera.position, frustum, (polygons) => {
            restoredVisited.push(polygons);
            return true;
        });

        // Should visit the same polygons
        expect(restoredVisited.length).toBe(originalVisited.length);
        // Both should find some polygons (not all culled)
        expect(originalVisited.length).toBeGreaterThan(0);
    });

    test('walkWithFrustum with corrupted null bounds culls everything (demonstrating the bug)', () => {
        // Manually construct a split tree to guarantee the structure
        const polyA = makePolygon([[0, 0], [50, 0], [50, 50], [0, 50]]);
        const polyB = makePolygon([[60, 60], [110, 60], [110, 110], [60, 110]]);
        const frontLeaf = createLeaf([polyA]);
        const backLeaf = createLeaf([polyB]);
        const plane = { n: [0, 1] as [number, number], d: 55 };
        const testBsp = createNode(plane, frontLeaf, backLeaf, []);
        expect(testBsp.type).toBe('split');

        // Camera at y=20 looking forward (positive y). Both polygons are in front.
        // Key insight: camera plane d = 20 (positive), so null bounds (dot=0)
        // satisfy 0 < 20 = true → classified as "behind camera" → culled.
        // But real polygon bounds have p-vertex dots of 50 and 110, both > 20 → visible.
        const camera = makeCamera({ position: [55, 20], direction: [0, 10], plane: [100, 0] });
        const frustum = camera.planes;

        // Verify null bounds are classified as outside this frustum
        const nullBounds: BoundingBox = [[null, null] as any, [null, null] as any];
        expect(isAABBOutsideFrustum(nullBounds, frustum)).toBe(true);

        // With correct bounds, both polygons are visible from this camera
        const originalVisited: IPolygon[][] = [];
        walkWithFrustum(testBsp, camera.position, frustum, (polygons) => {
            originalVisited.push(polygons);
            return true;
        });
        expect(originalVisited.length).toBeGreaterThan(0);

        // Corrupt split node bounds to [[null,null],[null,null]] (simulates Infinity→null from JSON)
        const corrupted = JSON.parse(JSON.stringify(testBsp));
        corrupted.bounds = [[null, null], [null, null]];

        // With corrupted split node bounds, root is culled — nothing visited
        const corruptedVisited: IPolygon[][] = [];
        walkWithFrustum(corrupted, camera.position, frustum, (polygons) => {
            corruptedVisited.push(polygons);
            return true;
        });

        // The corrupted tree visits nothing because the root split node is culled
        expect(corruptedVisited.length).toBe(0);
    });
});
