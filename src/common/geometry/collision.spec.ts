import { createPlane, Plane } from '../math/plane';
import { 
    makeRay, 
    intersectRayPlane, 
    hasIntersect, 
    detectCollisionAt, 
    intersectRaySegment, 
    intersectRayPolygons, 
    intersectRayEdge,
    lookupMaterialFor,
    createEmptyIntersection,
    IRay,
    RayCastingOptions
} from './collision';
import { Face, IMaterial } from './properties';
import { polygons, materialFactory, resetTestRandom } from '../testing/factories';
import { IPolygon, BoundingBox } from './polygon';
import { makeEdge, IEdge } from './edge';
import { normalize, perpendicular, add } from '../math/vector';
import { ILineSegment } from '../math/lineSegment';

describe('collision tests', () => {
    beforeEach(() => resetTestRandom());

    describe('makeRay', () => {
        it('creates ray with position and direction', () => {
            const ray = makeRay([10, 20], [1, 0]);
            expect(ray.position).toEqual([10, 20]);
            expect(ray.direction).toEqual([1, 0]);
        });

        it('calculates normalized direction', () => {
            const ray = makeRay([0, 0], [3, 4]);
            expect(ray.dn[0]).toBeCloseTo(0.6);
            expect(ray.dn[1]).toBeCloseTo(0.8);
        });

        it('calculates perpendicular of normalized direction', () => {
            const ray = makeRay([0, 0], [1, 0]);
            expect(ray.dperp[0]).toBeCloseTo(0);
            expect(ray.dperp[1]).toBeCloseTo(1);
        });

        it('calculates inverse of direction (ood)', () => {
            const ray = makeRay([0, 0], [2, 4]);
            expect(ray.ood).toEqual([0.5, 0.25]);
        });

        it('creates line from position to position+direction', () => {
            const ray = makeRay([5, 10], [3, 4]);
            expect(ray.line[0]).toEqual([5, 10]);
            expect(ray.line[1]).toEqual([8, 14]);
        });

        it('uses provided angle', () => {
            const ray = makeRay([0, 0], [1, 0], Math.PI / 4);
            expect(ray.angle).toBe(Math.PI / 4);
            expect(ray.cosAngle).toBeCloseTo(Math.cos(Math.PI / 4));
        });

        it('defaults angle to 0', () => {
            const ray = makeRay([0, 0], [1, 0]);
            expect(ray.angle).toBe(0);
            expect(ray.cosAngle).toBe(1);
        });
    });

    describe('hasIntersect (ray-box intersection)', () => {
        const box: BoundingBox = [[0, 0], [100, 100]];

        it('returns true when ray starts inside box', () => {
            const ray = makeRay([50, 50], [1, 0]);
            expect(hasIntersect(ray, box)).toBe(true);
        });

        it('returns true when ray points toward box', () => {
            const ray = makeRay([-50, 50], [1, 0]);
            expect(hasIntersect(ray, box)).toBe(true);
        });

        it('returns false when ray points away from box', () => {
            const ray = makeRay([-50, 50], [-1, 0]);
            expect(hasIntersect(ray, box)).toBe(false);
        });

        it('returns false when ray misses box entirely (above)', () => {
            const ray = makeRay([-50, 150], [1, 0]);
            expect(hasIntersect(ray, box)).toBe(false);
        });

        it('returns false when ray misses box entirely (below)', () => {
            const ray = makeRay([-50, -50], [1, 0]);
            expect(hasIntersect(ray, box)).toBe(false);
        });

        it('returns true when ray grazes box edge', () => {
            const ray = makeRay([-50, 0], [1, 0]);
            expect(hasIntersect(ray, box)).toBe(true);
        });

        it('returns true for diagonal ray through box', () => {
            const ray = makeRay([-50, -50], [1, 1]);
            expect(hasIntersect(ray, box)).toBe(true);
        });

        it('handles vertical ray (direction x = 0)', () => {
            const ray = makeRay([50, -50], [0, 1]);
            expect(hasIntersect(ray, box)).toBe(true);
        });

        it('handles horizontal ray (direction y = 0)', () => {
            const ray = makeRay([-50, 50], [1, 0]);
            expect(hasIntersect(ray, box)).toBe(true);
        });

        it('returns false when ray origin outside and direction parallel to box (x)', () => {
            const ray = makeRay([-50, 50], [0, 1]);
            expect(hasIntersect(ray, box)).toBe(false);
        });

        it('returns false when ray origin outside and direction parallel to box (y)', () => {
            const ray = makeRay([50, -50], [1, 0]);
            expect(hasIntersect(ray, box)).toBe(false);
        });
    });

    describe('intersectRaySegment', () => {
        it('returns intersection when ray hits segment', () => {
            const ray = makeRay([0, 5], [1, 0]);
            const segment: ILineSegment = [[10, 0], [10, 10]];
            const result = intersectRaySegment(ray, segment);
            expect(result).not.toBeNull();
            expect(result.point[0]).toBeCloseTo(10);
            expect(result.point[1]).toBeCloseTo(5);
        });

        it('returns null when ray misses segment (too high)', () => {
            const ray = makeRay([0, 15], [1, 0]);
            const segment: ILineSegment = [[10, 0], [10, 10]];
            expect(intersectRaySegment(ray, segment)).toBeNull();
        });

        it('returns null when ray misses segment (too low)', () => {
            const ray = makeRay([0, -5], [1, 0]);
            const segment: ILineSegment = [[10, 0], [10, 10]];
            expect(intersectRaySegment(ray, segment)).toBeNull();
        });

        it('returns null when ray points away from segment', () => {
            const ray = makeRay([0, 5], [-1, 0]);
            const segment: ILineSegment = [[10, 0], [10, 10]];
            expect(intersectRaySegment(ray, segment)).toBeNull();
        });

        it('returns interior face when ray hits from front', () => {
            const ray = makeRay([0, 5], [1, 0]);
            const segment: ILineSegment = [[10, 0], [10, 10]]; // wall facing left
            const result = intersectRaySegment(ray, segment);
            expect(result.face).toBe(Face.interior);
        });

        it('returns exterior face when ray hits from back', () => {
            const ray = makeRay([20, 5], [-1, 0]);
            const segment: ILineSegment = [[10, 0], [10, 10]]; // wall facing left
            const result = intersectRaySegment(ray, segment);
            expect(result.face).toBe(Face.exterior);
        });

        it('handles diagonal ray hitting segment', () => {
            const ray = makeRay([0, 0], [1, 1]);
            const segment: ILineSegment = [[5, 0], [5, 10]];
            const result = intersectRaySegment(ray, segment);
            expect(result).not.toBeNull();
            expect(result.point[0]).toBeCloseTo(5);
            expect(result.point[1]).toBeCloseTo(5);
        });
    });

    describe('intersectRayPlane', () => {
        it('intersects ray with plane - basic cases', () => {
            expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[-10,20],[0,10]]))).toEqual({point: [5,5], face: Face.interior});
            expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[2,-2],[2,0]]))).toEqual({point: [2,2], face: Face.exterior});
            expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[2,0],[2,-2]]))).toEqual({point: [2,2], face: Face.interior});
            expect(intersectRayPlane(makeRay([1,1], [0,0]), createPlane([[0,10],[10,0]]))).toBeNull();
            expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[0,10],[10,20]]))).toBeNull();        
            expect(intersectRayPlane(makeRay([0,0], [-1/2,1]), createPlane([[-10,20],[0,10]]))).toEqual({point: [-10,20], face: Face.interior});
        });

        it('returns null when ray is parallel to plane', () => {
            const ray = makeRay([0, 0], [1, 0]);
            const plane = createPlane([[0, 10], [10, 10]]); // horizontal plane
            expect(intersectRayPlane(ray, plane)).toBeNull();
        });

        it('returns null when ray points away from plane', () => {
            const ray = makeRay([0, 0], [-1, -1]);
            const plane = createPlane([[10, 0], [10, 10]]);
            expect(intersectRayPlane(ray, plane)).toBeNull();
        });
    });

    describe('detectCollisionAt', () => {
        it('returns undefined when no polygons', () => {
            const result = detectCollisionAt([50, 50], []);
            expect(result).toBeUndefined();
        });

        it('returns undefined when point is far from all polygons', () => {
            const poly = polygons.square(0, 0, 10);
            const result = detectCollisionAt([1000, 1000], [poly]);
            expect(result).toBeUndefined();
        });

        it('returns vertex collision when point is closest to vertex', () => {
            const poly = polygons.square(0, 0, 100);
            const result = detectCollisionAt([1, 1], [poly]);
            expect(result).toBeDefined();
            expect(result.kind).toBe('vertex');
            expect(result.polygon).toBe(poly);
        });

        it('returns edge collision when point is closest to edge midpoint', () => {
            const poly = polygons.square(0, 0, 100);
            const result = detectCollisionAt([50, 1], [poly]);
            expect(result).toBeDefined();
            expect(result.kind).toBe('edge');
            expect(result.polygon).toBe(poly);
        });

        it('chooses closest collision from multiple polygons', () => {
            const poly1 = polygons.square(0, 0, 10);
            const poly2 = polygons.square(5, 5, 10);
            const result = detectCollisionAt([6, 6], [poly1, poly2]);
            expect(result).toBeDefined();
            // Should detect collision with poly2 vertex at [5,5] which is closer
            expect(result.polygon).toBe(poly2);
        });

        it('uses distance threshold of 10 units', () => {
            const poly = polygons.square(0, 0, 100);
            // Point at [11, 11] is >10 units from vertex at [0,0]
            const result = detectCollisionAt([12, 12], [poly]);
            expect(result).toBeUndefined();
        });
    });

    describe('intersectRayEdge', () => {
        it('returns intersection when ray hits edge', () => {
            const ray = makeRay([0, 5], [1, 0]);
            const edge = makeEdge([10, 0], [10, 10]);
            const result = intersectRayEdge(edge, ray);
            expect(result).not.toBeNull();
            expect(result.intersection).not.toBeNull();
            expect(result.intersection.point[0]).toBeCloseTo(10);
        });

        it('returns null intersection when ray misses edge', () => {
            const ray = makeRay([0, 15], [1, 0]);
            const edge = makeEdge([10, 0], [10, 10]);
            const result = intersectRayEdge(edge, ray);
            expect(result.intersection).toBeNull();
        });

        it('calculates distance correctly', () => {
            const ray = makeRay([0, 5], [1, 0]);
            const edge = makeEdge([10, 0], [10, 10]);
            const result = intersectRayEdge(edge, ray);
            expect(result.distance).toBeCloseTo(10);
        });

        it('applies cosAngle correction to distance', () => {
            const angle = Math.PI / 6; // 30 degrees
            const ray = makeRay([0, 0], [1, 0], angle);
            const edge = makeEdge([10, -5], [10, 5]);
            const result = intersectRayEdge(edge, ray);
            expect(result.distance).toBeCloseTo(10 * Math.cos(angle));
        });

        it('respects edgeFilter option', () => {
            const ray = makeRay([0, 5], [1, 0]);
            const edge = makeEdge([10, 0], [10, 10]);
            edge.immaterial = true;
            
            const options: RayCastingOptions = {
                edgeFilter: (e) => !e.immaterial
            };
            const result = intersectRayEdge(edge, ray, options);
            expect(result).toBeNull();
        });

        it('passes edge through when no filter', () => {
            const ray = makeRay([0, 5], [1, 0]);
            const edge = makeEdge([10, 0], [10, 10]);
            const result = intersectRayEdge(edge, ray, undefined);
            expect(result).not.toBeNull();
        });
    });

    describe('intersectRayPolygons', () => {
        it('returns empty hits when no polygons', () => {
            const ray = makeRay([0, 0], [1, 0]);
            const result = intersectRayPolygons([], ray, {});
            expect(result.hits).toHaveLength(0);
            expect(result.polygonCount).toBe(0);
        });

        it('returns hits for ray passing through polygon', () => {
            const poly = polygons.square(10, -10, 20);
            const ray = makeRay([0, 0], [1, 0]);
            const result = intersectRayPolygons([poly], ray, {});
            expect(result.hits.length).toBeGreaterThan(0);
        });

        it('tracks polygon count and ids', () => {
            const poly1 = polygons.square(10, -10, 20);
            const poly2 = polygons.square(50, -10, 20);
            const ray = makeRay([0, 0], [1, 0]);
            const result = intersectRayPolygons([poly1, poly2], ray, {});
            expect(result.polygonCount).toBe(2);
            expect(result.polygonIds.size).toBe(2);
        });

        it('skips large polygons that ray does not intersect bounding box', () => {
            // Create polygon with >5 edges (hexagon)
            const poly = polygons.convex(6, 500, 500, 50);
            const ray = makeRay([0, 0], [1, 0]); // Will miss the hexagon
            const result = intersectRayPolygons([poly], ray, {});
            expect(result.polygonIds.size).toBe(0); // Should skip due to bounding box check
        });

        it('uses earlyExitPredicate to set stop flag', () => {
            const poly = polygons.square(10, -10, 20);
            const ray = makeRay([0, 0], [1, 0]);
            const options: RayCastingOptions = {
                earlyExitPredicate: () => true
            };
            const result = intersectRayPolygons([poly], ray, options);
            expect(result.stop).toBe(true);
        });

        it('applies edge filter', () => {
            const poly = polygons.square(10, -10, 20);
            poly.edges.forEach(e => e.immaterial = true);
            const ray = makeRay([0, 0], [1, 0]);
            const options: RayCastingOptions = {
                edgeFilter: (e) => !e.immaterial
            };
            const result = intersectRayPolygons([poly], ray, options);
            expect(result.hits).toHaveLength(0);
        });
    });

    describe('lookupMaterialFor', () => {
        it('returns null when intersection is null', () => {
            const edge = makeEdge([0, 0], [10, 0]);
            edge.material = materialFactory.build();
            expect(lookupMaterialFor(null as any, edge)).toBeNull();
        });

        it('returns null when edge is null', () => {
            const intersection = { point: [5, 0] as [number, number], face: Face.interior };
            expect(lookupMaterialFor(intersection, null as any)).toBeNull();
        });

        it('returns material for interior face with single material', () => {
            const edge = makeEdge([0, 0], [10, 0]);
            const material = materialFactory.build();
            edge.material = material;
            const intersection = { point: [5, 0] as [number, number], face: Face.interior };
            expect(lookupMaterialFor(intersection, edge)).toBe(material);
        });

        it('returns front material for interior face with directed material', () => {
            const edge = makeEdge([0, 0], [10, 0]);
            const frontMat = materialFactory.build();
            const backMat = materialFactory.build();
            edge.material = [frontMat, backMat];
            const intersection = { point: [5, 0] as [number, number], face: Face.interior };
            expect(lookupMaterialFor(intersection, edge)).toBe(frontMat);
        });

        it('returns back material for exterior face with directed material', () => {
            const edge = makeEdge([0, 0], [10, 0]);
            const frontMat = materialFactory.build();
            const backMat = materialFactory.build();
            edge.material = [frontMat, backMat];
            const intersection = { point: [5, 0] as [number, number], face: Face.exterior };
            expect(lookupMaterialFor(intersection, edge)).toBe(backMat);
        });
    });

    describe('createEmptyIntersection', () => {
        it('creates empty intersection result', () => {
            const result = createEmptyIntersection();
            expect(result.hits).toEqual([]);
            expect(result.stop).toBe(false);
            expect(result.edgeCount).toBe(0);
            expect(result.polygonCount).toBe(0);
            expect(result.polygonIds).toBeInstanceOf(Set);
            expect(result.polygonIds.size).toBe(0);
        });
    });
});