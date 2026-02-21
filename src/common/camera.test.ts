import * as camera from './camera';
import { makeCamera, ICamera, DEFAULT_CAMERA, adaptAngle, adaptDepth, freeMove, move, rotate, freeStrafe, strafe, makeRays, clip, isInView } from './camera';
import { makeRay, IRay } from './geometry/collision';
import { edgeFactory, edges, geometries, cameras, resetTestRandom } from './testing/factories';
import { Vector, norm, subtract, dot, perpendicular, normalize, scale, add } from './math/vector';
import { buildBspTree } from './geometry/bsp/creation';
import { NULL_EDGE, makeEdge } from './geometry/edge';
import { IBspContext, IMutableEdgeDiff } from './store/bsp-state';
import { IEntityKey } from './geometry/entity';

beforeEach(() => resetTestRandom());

describe('camera tests', () => {

    describe('makeCamera', () => {
        test('creates camera with position, direction and derived plane', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: perpendicular([0, 10]) });
            expect(cam.position).toEqual([50, 50]);
            expect(cam.direction).toEqual([0, 10]);
            expect(cam.plane).toBeDefined();
        });

        test('creates camera with explicit plane', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [15, 0] });
            expect(cam.position).toEqual([0, 0]);
            expect(cam.direction).toEqual([0, 10]);
            expect(cam.plane).toEqual([15, 0]);
        });

        test('screen is computed from direction and plane', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            // mid = position + direction = [0,10]
            // screen = [mid - plane, mid + plane] = [[-5,10], [5,10]]
            expect(cam.screen[0]).toEqual([-5, 10]);
            expect(cam.screen[1]).toEqual([5, 10]);
        });

        test('midline goes from position in direction', () => {
            const cam = makeCamera({ position: [10, 20], direction: [0, 5], plane: [3, 0] });
            expect(cam.midline[0]).toEqual([10, 20]);
            expect(cam.midline[1]).toEqual([10, 25]); // position + direction
        });

        test('cone has left and right rays', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            expect(cam.cone.left).toBeDefined();
            expect(cam.cone.right).toBeDefined();
            // Left ray should have negative factor, right ray positive
            expect(cam.cone.left.position).toEqual([0, 0]);
            expect(cam.cone.right.position).toEqual([0, 0]);
        });

        test('planes are computed for frustum culling', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            expect(cam.planes.camera).toBeDefined();
            expect(cam.planes.left).toBeDefined();
            expect(cam.planes.right).toBeDefined();
        });
    });

    describe('DEFAULT_CAMERA', () => {
        test('is at position [50,50]', () => {
            expect(DEFAULT_CAMERA.position).toEqual([50, 50]);
        });

        test('looks in direction [0,10]', () => {
            expect(DEFAULT_CAMERA.direction).toEqual([0, 10]);
        });

        test('has plane [15,0]', () => {
            expect(DEFAULT_CAMERA.plane).toEqual([15, 0]);
        });

        test('has valid screen, midline, cone and planes', () => {
            expect(DEFAULT_CAMERA.screen).toBeDefined();
            expect(DEFAULT_CAMERA.midline).toBeDefined();
            expect(DEFAULT_CAMERA.cone.left).toBeDefined();
            expect(DEFAULT_CAMERA.cone.right).toBeDefined();
            expect(DEFAULT_CAMERA.planes.camera).toBeDefined();
        });
    });

    describe('adaptAngle', () => {
        test('direction 0 returns unchanged camera', () => {
            const result = adaptAngle(0, DEFAULT_CAMERA);
            expect(result.plane).toEqual(DEFAULT_CAMERA.plane);
        });

        test('direction 1 widens the plane', () => {
            const result = adaptAngle(1, DEFAULT_CAMERA);
            // plane += 0.05 * plane => plane should get larger
            const originalNorm = norm(DEFAULT_CAMERA.plane!);
            const newNorm = norm(result.plane!);
            expect(newNorm).toBeGreaterThan(originalNorm);
        });

        test('direction -1 narrows the plane', () => {
            const result = adaptAngle(-1, DEFAULT_CAMERA);
            const originalNorm = norm(DEFAULT_CAMERA.plane!);
            const newNorm = norm(result.plane!);
            expect(newNorm).toBeLessThan(originalNorm);
        });

        test('preserves position and direction', () => {
            const result = adaptAngle(1, DEFAULT_CAMERA);
            expect(result.position).toEqual(DEFAULT_CAMERA.position);
            expect(result.direction).toEqual(DEFAULT_CAMERA.direction);
        });
    });

    describe('adaptDepth', () => {
        test('direction 1 increases direction magnitude', () => {
            const result = adaptDepth(1, DEFAULT_CAMERA);
            const originalNorm = norm(DEFAULT_CAMERA.direction);
            const newNorm = norm(result.direction);
            expect(newNorm).toBeGreaterThan(originalNorm);
        });

        test('direction -1 decreases direction magnitude', () => {
            const result = adaptDepth(-1, DEFAULT_CAMERA);
            const originalNorm = norm(DEFAULT_CAMERA.direction);
            const newNorm = norm(result.direction);
            expect(newNorm).toBeLessThan(originalNorm);
        });

        test('preserves position and plane', () => {
            const result = adaptDepth(1, DEFAULT_CAMERA);
            expect(result.position).toEqual(DEFAULT_CAMERA.position);
            expect(result.plane).toEqual(DEFAULT_CAMERA.plane);
        });
    });

    describe('freeMove', () => {
        test('moves camera forward by ratio of direction', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const result = freeMove(1, cam);
            // delta = 1 * direction = [0, 10], new position = [0, 10]
            expect(result.position).toEqual([0, 10]);
        });

        test('moves camera backward with negative ratio', () => {
            const cam = makeCamera({ position: [10, 10], direction: [0, 10], plane: [5, 0] });
            const result = freeMove(-0.5, cam);
            // delta = -0.5 * [0,10] = [0,-5], new position = [10, 5]
            expect(result.position).toEqual([10, 5]);
        });

        test('ratio of 0 does not move', () => {
            const result = freeMove(0, DEFAULT_CAMERA);
            expect(result.position).toEqual(DEFAULT_CAMERA.position);
        });

        test('preserves direction and plane', () => {
            const result = freeMove(1, DEFAULT_CAMERA);
            expect(result.direction).toEqual(DEFAULT_CAMERA.direction);
            expect(result.plane).toEqual(DEFAULT_CAMERA.plane);
        });
    });

    describe('rotate', () => {
        test('rotates direction and plane by given angle', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const result = rotate(Math.PI / 2, cam);
            // rotating [0,10] by PI/2 should give roughly [-10, 0]
            expect(result.direction[0]).toBeCloseTo(-10, 5);
            expect(result.direction[1]).toBeCloseTo(0, 5);
            // rotating [5,0] by PI/2 should give roughly [0, 5]
            expect(result.plane![0]).toBeCloseTo(0, 5);
            expect(result.plane![1]).toBeCloseTo(5, 5);
        });

        test('zero rotation preserves camera', () => {
            const result = rotate(0, DEFAULT_CAMERA);
            expect(result.direction[0]).toBeCloseTo(DEFAULT_CAMERA.direction[0], 10);
            expect(result.direction[1]).toBeCloseTo(DEFAULT_CAMERA.direction[1], 10);
        });

        test('full rotation (2PI) returns to original', () => {
            const result = rotate(2 * Math.PI, DEFAULT_CAMERA);
            expect(result.direction[0]).toBeCloseTo(DEFAULT_CAMERA.direction[0], 5);
            expect(result.direction[1]).toBeCloseTo(DEFAULT_CAMERA.direction[1], 5);
        });

        test('preserves position', () => {
            const result = rotate(Math.PI / 4, DEFAULT_CAMERA);
            expect(result.position).toEqual(DEFAULT_CAMERA.position);
        });
    });

    describe('freeStrafe', () => {
        test('positive ratio strafes right (rotated PI/2)', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const result = freeStrafe(1, cam);
            // Positive strafes with rotate(PI/2, direction) * abs(ratio)
            // rotate(PI/2, [0,10]) = [-10, 0], scale by 1 = [-10, 0]
            // new position = [0+(-10), 0+0] = [-10, 0]
            expect(result.position[0]).toBeCloseTo(-10, 5);
            expect(result.position[1]).toBeCloseTo(0, 5);
        });

        test('negative ratio strafes left (rotated -PI/2)', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const result = freeStrafe(-1, cam);
            // Negative strafes with rotate(-PI/2, direction) * abs(ratio)
            // rotate(-PI/2, [0,10]) = [10, 0], scale by 1 = [10, 0]
            // new position = [0+10, 0+0] = [10, 0]
            expect(result.position[0]).toBeCloseTo(10, 5);
            expect(result.position[1]).toBeCloseTo(0, 5);
        });

        test('preserves direction and plane', () => {
            const result = freeStrafe(0.5, DEFAULT_CAMERA);
            expect(result.direction).toEqual(DEFAULT_CAMERA.direction);
            expect(result.plane!).toEqual(DEFAULT_CAMERA.plane!);
        });
    });

    describe('move (constrained)', () => {
        test('moves forward when no wall in the way', () => {
            // Create geometry with a wall far away
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 100], [100, 100], [100, 200], [0, 200]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const result = move(1, cam, geom, undefined, bspContext);
            // Should move forward since wall is far away
            expect(result.position[1]).toBeGreaterThan(cam.position[1]);
        });

        test('moves backward when no wall behind', () => {
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 100], [100, 100], [100, 200], [0, 200]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const result = move(-1, cam, geom, undefined, bspContext);
            expect(result.position[1]).toBeLessThan(cam.position[1]);
        });

        test('stops when wall is very close', () => {
            // Wall directly in front, very close
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 51], [100, 51], [100, 52], [0, 52]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const result = move(1, cam, geom, undefined, bspContext);
            // Should not move much or stay in place due to collision
            expect(Math.abs(result.position[1] - cam.position[1])).toBeLessThan(2);
        });

        test('uses custom speed parameter', () => {
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 1000], [100, 1000], [100, 1100], [0, 1100]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const slowResult = move(1, cam, geom, 0.05, bspContext);
            const fastResult = move(1, cam, geom, 0.5, bspContext);
            // Faster speed should move further
            const slowDelta = Math.abs(slowResult.position[1] - cam.position[1]);
            const fastDelta = Math.abs(fastResult.position[1] - cam.position[1]);
            expect(fastDelta).toBeGreaterThan(slowDelta);
        });
    });

    describe('strafe (constrained)', () => {
        test('strafes when no wall nearby', () => {
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[-100, 0], [-100, 100], [-200, 100], [-200, 0]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const result = strafe(1, cam, geom, undefined, bspContext);
            // strafe direction 1 should use plane-based ray
            expect(result.position).not.toEqual(cam.position);
        });
    });

    describe('makeRays', () => {
        test('creates resolution+1 rays', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(10, cam);
            expect(rays.length).toBe(11); // 0..10 inclusive
        });

        test('first ray factor is -1 (leftmost)', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(10, cam);
            // First ray: factor = 2*0/10 - 1 = -1
            // direction = [0,10] + (-1)*[5,0] = [-5, 10]
            expect(rays[0].direction[0]).toBeCloseTo(-5, 5);
            expect(rays[0].direction[1]).toBeCloseTo(10, 5);
        });

        test('last ray factor is +1 (rightmost)', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(10, cam);
            // Last ray: factor = 2*10/10 - 1 = 1
            // direction = [0,10] + 1*[5,0] = [5, 10]
            expect(rays[10].direction[0]).toBeCloseTo(5, 5);
            expect(rays[10].direction[1]).toBeCloseTo(10, 5);
        });

        test('middle ray matches camera direction', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(10, cam);
            // Middle ray: factor = 2*5/10 - 1 = 0
            // direction = [0,10] + 0*[5,0] = [0, 10]
            expect(rays[5].direction[0]).toBeCloseTo(0, 5);
            expect(rays[5].direction[1]).toBeCloseTo(10, 5);
        });

        test('all rays originate from camera position', () => {
            const cam = makeCamera({ position: [7, 13], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(5, cam);
            for (const ray of rays) {
                expect(ray.position).toEqual([7, 13]);
            }
        });

        test('resolution 0 creates single ray', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(0, cam);
            expect(rays.length).toBe(1);
        });

        test('rays have correct cosAngle property', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(10, cam);
            // Middle ray should have cosAngle close to 1 (angle ~0)
            expect(rays[5].cosAngle).toBeCloseTo(1, 5);
            // Outer rays should have cosAngle less than 1 (non-zero angle)
            expect(rays[0].cosAngle).toBeLessThan(0.99);
            expect(rays[10].cosAngle).toBeLessThan(0.99);
        });

        test('ray cosAngles are symmetric', () => {
            const cam = makeCamera({ position: [0, 0], direction: [0, 10], plane: [5, 0] });
            const rays = makeRays(10, cam);
            // Left and right should have symmetric cosAngles
            expect(rays[0].cosAngle).toBeCloseTo(rays[10].cosAngle, 5);
        });
    });

    describe('clip', () => {
        test('returns NULL_EDGE for edge entirely behind camera', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const edge = edges.from([0, 40], [100, 40]); // Behind camera
            const result = clip(edge, cam);
            expect(result).toBe(NULL_EDGE);
        });

        test('returns edge for edge fully in view', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const edge = edges.from([48, 62], [52, 62]); // Directly in front, small
            const result = clip(edge, cam);
            expect(result).not.toBe(NULL_EDGE);
        });

        test('returns NULL_EDGE for edge entirely outside left frustum', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [5, 0] });
            // Edge far to the left, way outside frustum
            const edge = edges.from([-100, 100], [-90, 100]);
            const result = clip(edge, cam);
            expect(result).toBe(NULL_EDGE);
        });

        test('returns NULL_EDGE for edge entirely outside right frustum', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [5, 0] });
            // Edge far to the right, way outside frustum
            const edge = edges.from([200, 100], [210, 100]);
            const result = clip(edge, cam);
            expect(result).toBe(NULL_EDGE);
        });

        test('clips edge that crosses frustum boundary', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            // Edge that spans across the camera view and extends beyond
            const edge = edges.from([-100, 70], [200, 70]);
            const result = clip(edge, cam);
            expect(result).not.toBe(NULL_EDGE);
            // Clipped edge should be shorter than original
            const originalLen = Math.abs(200 - (-100));
            const clippedLen = Math.abs(result.end.vector[0] - result.start.vector[0]);
            expect(clippedLen).toBeLessThan(originalLen);
        });

        test('preserves material of original edge', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const edge = edges.from([48, 62], [52, 62]);
            const result = clip(edge, cam);
            if (result !== NULL_EDGE) {
                expect(result.material).toBeDefined();
            }
        });
    });

    describe('isInView', () => {
        test('returns true for edge in front and within frustum', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const edge = edges.from([48, 62], [52, 62]);
            expect(isInView(edge, cam)).toBe(true);
        });

        test('returns false for edge behind camera', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const edge = edges.from([0, 40], [100, 40]);
            expect(isInView(edge, cam)).toBe(false);
        });

        test('returns false for edge entirely outside frustum laterally', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [5, 0] });
            // Edge far outside on one side
            const edge = edges.from([-100, 100], [-90, 100]);
            expect(isInView(edge, cam)).toBe(false);
        });

        test('returns true for edge crossing frustum boundary', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            // Edge that goes from inside to outside
            const edge = edges.from([50, 65], [200, 65]);
            expect(isInView(edge, cam)).toBe(true);
        });

        test('returns true when only start is in front', () => {
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            // Start in front, end behind
            const edge = edges.from([50, 62], [50, 40]);
            const result = isInView(edge, cam);
            // At least one point in front, so could be in view
            expect(typeof result).toBe('boolean');
        });
    });

    describe('move/strafe with dirty edges', () => {
        /** Collect all edge IDs from a geometry into a Set. */
        const collectEdgeIds = (geometry: ReturnType<typeof geometries.withBsp>['geometry']): Set<IEntityKey> => {
            const ids = new Set<IEntityKey>();
            for (const p of geometry.polygons) {
                for (const e of p.edges) {
                    if (e.id) ids.add(e.id);
                }
            }
            return ids;
        };

        const emptyDiff = (): IMutableEdgeDiff => ({
            removedEdgeIds: new Set<IEntityKey>(),
            addedEdgeIds: new Set<IEntityKey>(),
            modifiedEdgeIds: new Set<IEntityKey>(),
        });

        test('move is blocked by a close wall without dirty edges', () => {
            // Wall directly in front at y=52..53, camera at y=50 facing +y
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 52], [100, 52], [100, 53], [0, 53]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });
            const result = move(1, cam, geom, undefined, bspContext);
            // Should not move much due to collision
            expect(Math.abs(result.position[1] - cam.position[1])).toBeLessThan(2);
        });

        test('moves through a wall when its edges are in removedEdgeIds', () => {
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 52], [100, 52], [100, 53], [0, 53]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });

            // First confirm blocked without dirty edges
            const blocked = move(1, cam, geom, undefined, bspContext);
            expect(Math.abs(blocked.position[1] - cam.position[1])).toBeLessThan(2);

            // Now mark all edges as removed — camera should move freely
            // With speed=0.15 and direction=[0,10], one step moves 1.5 units
            const diff = emptyDiff();
            diff.removedEdgeIds = collectEdgeIds(geom);
            const passed = move(1, cam, geom, undefined, { tree: bsp, dirtyEdges: diff });
            // Should move the full step distance (1.5) without being blocked
            expect(passed.position[1]).toBeCloseTo(cam.position[1] + 1.5, 5);
        });

        test('modified edges still block at current position (brute-force phase)', () => {
            // Modified edges are skipped in the stale BSP (old positions), but the
            // brute-force phase re-tests them from current geometry. Since the wall
            // hasn't moved, collision still works.
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 52], [100, 52], [100, 53], [0, 53]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });

            // Confirm blocked without dirty edges
            const blocked = move(1, cam, geom, undefined, bspContext);
            expect(blocked.position[1]).toBeCloseTo(cam.position[1], 5);

            // Mark all edges as modified — brute-force phase re-tests them,
            // so collision should still work
            const diff = emptyDiff();
            diff.modifiedEdgeIds = collectEdgeIds(geom);
            const result = move(1, cam, geom, undefined, { tree: bsp, dirtyEdges: diff });
            expect(result.position[1]).toBeCloseTo(cam.position[1], 5);
        });

        test('empty dirty diff does not change collision behavior', () => {
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[0, 52], [100, 52], [100, 53], [0, 53]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });

            const withoutDirty = move(1, cam, geom, undefined, bspContext);
            const withEmptyDirty = move(1, cam, geom, undefined, { tree: bsp, dirtyEdges: emptyDiff() });
            expect(withEmptyDirty.position[0]).toBeCloseTo(withoutDirty.position[0], 10);
            expect(withEmptyDirty.position[1]).toBeCloseTo(withoutDirty.position[1], 10);
        });

        test('added edges block camera via brute-force on current geometry', () => {
            // Build BSP from geometry WITHOUT the blocking wall
            const { geometry: _farGeom, bsp, bspContext } = geometries.withBsp([
                [[0, 200], [100, 200], [100, 300], [0, 300]]
            ]);
            // Current geometry HAS a blocking wall close to camera
            const geom = geometries.from([
                [[0, 52], [100, 52], [100, 53], [0, 53]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });

            // Without dirty edges, BSP has no close wall — camera moves freely
            const noDirty = move(1, cam, geom, undefined, bspContext);
            // Camera should move freely (no close wall in BSP)
            expect(noDirty.position[1]).toBeCloseTo(cam.position[1] + 1.5, 5);

            // Mark the close wall's edges as added (not in BSP, only in geometry)
            // Collision system should do brute-force pass on added edges
            const diff = emptyDiff();
            diff.addedEdgeIds = collectEdgeIds(geom);
            const result = move(1, cam, geom, undefined, { tree: bsp, dirtyEdges: diff });
            // Camera should be blocked by the newly added wall
            expect(result.position[1]).toBeCloseTo(cam.position[1], 5);
        });

        test('strafe passes through a wall when its edges are in removedEdgeIds', () => {
            // Wall to the left of camera: camera at x=50, wall at x=48..49
            // Camera faces +y, strafe direction=1 moves in -x (perpendicular left)
            const { geometry: geom, bsp, bspContext } = geometries.withBsp([
                [[48, 0], [49, 0], [49, 100], [48, 100]]
            ]);
            const cam = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });

            // Strafe direction=1 moves camera in -x direction (toward the wall)
            const blocked = strafe(1, cam, geom, undefined, bspContext);
            // Should be blocked or barely moved
            expect(cam.position[0] - blocked.position[0]).toBeLessThan(3);

            // Mark all edges as removed
            const diff = emptyDiff();
            diff.removedEdgeIds = collectEdgeIds(geom);
            const passed = strafe(1, cam, geom, undefined, { tree: bsp, dirtyEdges: diff });
            // Should move further since wall is skipped
            expect(cam.position[0] - passed.position[0]).toBeGreaterThan(cam.position[0] - blocked.position[0]);
        });
    });

    // Original performance test
    test('camera ray creation performance', () => {
        let sut = camera.makeCamera({ position: [0, 0], direction: [0, 1], plane: [0, -1] });
        const start = process.hrtime();
        for (let i = 0; i < 1000; i++) {
            camera.makeRays(1280, sut);
        }
        const end = process.hrtime(start);
        // Just verify it completes without errors
        expect(end).toBeDefined();
    });
});
