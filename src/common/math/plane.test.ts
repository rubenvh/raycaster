import { 
    Plane, VOID_PLANE, createPlane, isSamePlane, planeSlope, 
    isPlaneSemiHorizontal, getBounds, intersectSegmentPlane 
} from './plane';
import { ILineSegment } from './lineSegment';
import { Vector, areEqual } from './vector';

describe('plane tests', () => {
    describe('VOID_PLANE constant', () => {
        it('has zero normal', () => expect(VOID_PLANE.n).toEqual([0, 0]));
        it('has zero distance', () => expect(VOID_PLANE.d).toBe(0));
    });

    describe('createPlane tests', () => {
        it('creates plane from horizontal segment', () => {
            const segment: ILineSegment = [[0, 0], [10, 0]];
            const plane = createPlane(segment);
            // Normal should be perpendicular to segment and normalized
            expect(plane.n[0]).toBeCloseTo(0);
            expect(plane.n[1]).toBeCloseTo(1);
            expect(plane.d).toBeCloseTo(0);
        });

        it('creates plane from vertical segment', () => {
            const segment: ILineSegment = [[0, 0], [0, 10]];
            const plane = createPlane(segment);
            expect(plane.n[0]).toBeCloseTo(-1);
            expect(plane.n[1]).toBeCloseTo(0);
            expect(plane.d).toBeCloseTo(0);
        });

        it('creates plane from diagonal segment', () => {
            const segment: ILineSegment = [[0, 0], [10, 10]];
            const plane = createPlane(segment);
            // Normal perpendicular to (10,10) is (-10, 10) normalized to (-1/sqrt2, 1/sqrt2)
            expect(plane.n[0]).toBeCloseTo(-1 / Math.SQRT2);
            expect(plane.n[1]).toBeCloseTo(1 / Math.SQRT2);
        });

        it('creates plane from offset segment', () => {
            const segment: ILineSegment = [[5, 5], [15, 5]];
            const plane = createPlane(segment);
            expect(plane.n[0]).toBeCloseTo(0);
            expect(plane.n[1]).toBeCloseTo(1);
            expect(plane.d).toBeCloseTo(5); // distance from origin
        });
    });

    describe('isSamePlane tests', () => {
        it('identical planes are the same', () => {
            const p1: Plane = { n: [0, 1], d: 5 };
            const p2: Plane = { n: [0, 1], d: 5 };
            expect(isSamePlane(p1, p2)).toBe(true);
        });

        it('different distances are not the same', () => {
            const p1: Plane = { n: [0, 1], d: 5 };
            const p2: Plane = { n: [0, 1], d: 10 };
            expect(isSamePlane(p1, p2)).toBe(false);
        });

        it('different normals are not the same', () => {
            const p1: Plane = { n: [0, 1], d: 5 };
            const p2: Plane = { n: [1, 0], d: 5 };
            expect(isSamePlane(p1, p2)).toBe(false);
        });

        it('VOID_PLANE equals itself', () => {
            expect(isSamePlane(VOID_PLANE, VOID_PLANE)).toBe(true);
        });
    });

    describe('planeSlope tests', () => {
        it('horizontal plane has slope 0', () => {
            const plane = createPlane([[0, 0], [10, 0]]);
            expect(planeSlope(plane)).toBe(0);
        });

        it('vertical plane has infinite slope', () => {
            const plane = createPlane([[0, 0], [0, 10]]);
            expect(Math.abs(planeSlope(plane))).toBe(Infinity);
        });

        it('45-degree plane has slope 1', () => {
            const plane = createPlane([[0, 0], [10, 10]]);
            expect(planeSlope(plane)).toBeCloseTo(1);
        });

        it('-45-degree plane has slope -1', () => {
            const plane = createPlane([[0, 10], [10, 0]]);
            expect(planeSlope(plane)).toBeCloseTo(-1);
        });
    });

    describe('isPlaneSemiHorizontal tests', () => {
        it('horizontal plane is semi-horizontal', () => {
            const plane = createPlane([[0, 0], [10, 0]]);
            expect(isPlaneSemiHorizontal(plane)).toBe(true);
        });

        it('45-degree plane is semi-horizontal (slope <= 1)', () => {
            const plane = createPlane([[0, 0], [10, 10]]);
            expect(isPlaneSemiHorizontal(plane)).toBe(true);
        });

        it('vertical plane is not semi-horizontal', () => {
            const plane = createPlane([[0, 0], [0, 10]]);
            expect(isPlaneSemiHorizontal(plane)).toBe(false);
        });

        it('steep plane is not semi-horizontal', () => {
            const plane = createPlane([[0, 0], [1, 10]]);
            expect(isPlaneSemiHorizontal(plane)).toBe(false);
        });
    });

    describe('getBounds tests', () => {
        it('horizontal plane bounds span x-axis', () => {
            const plane = createPlane([[0, 5], [10, 5]]);
            const bounds = getBounds(plane, 100, 100);
            expect(bounds[0][1]).toBeCloseTo(5); // y at x=0
            expect(bounds[1][1]).toBeCloseTo(5); // y at x=100
        });

        it('vertical plane bounds span y-axis', () => {
            const plane = createPlane([[5, 0], [5, 10]]);
            const bounds = getBounds(plane, 100, 100);
            expect(bounds[0][0]).toBeCloseTo(5); // x at y=0
            expect(bounds[1][0]).toBeCloseTo(5); // x at y=100
        });
    });

    describe('intersectSegmentPlane tests', () => {
        it('segment crossing plane returns intersection', () => {
            const plane = createPlane([[0, 5], [10, 5]]); // horizontal plane at y=5
            const segment: ILineSegment = [[5, 0], [5, 10]]; // vertical segment through y=5
            const result = intersectSegmentPlane(segment, plane);
            expect(result.t).toBeCloseTo(0.5);
            expect(result.q).toBeDefined();
            expect(result.q![0]).toBeCloseTo(5);
            expect(result.q![1]).toBeCloseTo(5);
        });

        it('segment ending at plane returns t=1', () => {
            const plane = createPlane([[0, 10], [10, 10]]); // horizontal plane at y=10
            const segment: ILineSegment = [[5, 0], [5, 10]];
            const result = intersectSegmentPlane(segment, plane);
            expect(result.t).toBeCloseTo(1);
            expect(result.q).toBeDefined();
        });

        it('segment starting at plane returns t=0', () => {
            const plane = createPlane([[0, 0], [10, 0]]); // horizontal plane at y=0
            const segment: ILineSegment = [[5, 0], [5, 10]];
            const result = intersectSegmentPlane(segment, plane);
            expect(result.t).toBeCloseTo(0);
            expect(result.q).toBeDefined();
        });

        it('segment parallel to plane returns no intersection', () => {
            const plane = createPlane([[0, 5], [10, 5]]); // horizontal plane at y=5
            const segment: ILineSegment = [[0, 0], [10, 0]]; // horizontal segment at y=0
            const result = intersectSegmentPlane(segment, plane);
            // t will be outside [0,1] or NaN for parallel
            expect(result.q).toBeUndefined();
        });

        it('segment entirely in front of plane returns no q', () => {
            const plane = createPlane([[0, 5], [10, 5]]); // horizontal plane at y=5
            const segment: ILineSegment = [[0, 0], [10, 0]]; // segment at y=0, below plane
            const result = intersectSegmentPlane(segment, plane);
            expect(result.q).toBeUndefined();
        });

        it('segment entirely behind plane returns no q', () => {
            const plane = createPlane([[0, 5], [10, 5]]); // horizontal plane at y=5
            const segment: ILineSegment = [[0, 10], [10, 10]]; // segment at y=10, above plane
            const result = intersectSegmentPlane(segment, plane);
            expect(result.q).toBeUndefined();
        });

        it('diagonal segment crossing diagonal plane', () => {
            const plane = createPlane([[0, 0], [10, 10]]); // 45-degree plane
            const segment: ILineSegment = [[0, 10], [10, 0]]; // opposite diagonal
            const result = intersectSegmentPlane(segment, plane);
            expect(result.t).toBeCloseTo(0.5);
            expect(result.q).toBeDefined();
            expect(result.q![0]).toBeCloseTo(5);
            expect(result.q![1]).toBeCloseTo(5);
        });
    });
});
