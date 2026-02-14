import { ILineSegment, distanceTo, projectOn, midpoint, slope, lineAngle, segmentLength, normal, lineIntersect, distanceToMidPoint } from './lineSegment';
import { Vector } from '../math/vector';
import { intersectRaySegment, IRay, makeRay } from '../geometry/collision';
import { Face } from '../geometry/properties';

describe('line segment tests', () => {
    describe('ray intersection tests', () => {  
        let ray: IRay;
        const test = (s: ILineSegment, expected: Vector, face?: Face)=> {
            let actual = intersectRaySegment(ray, s);            
            if (expected) expect(actual?.point).toEqual(expected);
            else expect(actual).toBeNull();
            if (face) expect(actual?.face).toEqual(face);
        };

        describe('horizontal up ray', () => {
            beforeEach(() => {
                ray = makeRay([3,2],[0,3]);
            });
            it('test1',  () => test([[1,6],[5,6]], [3,6], Face.exterior));
            it('test1b', () => test([[5,6],[1,6]], [3,6], Face.interior));
            it('test2',  () => test([[3,3],[5,6]], [3,3], Face.exterior));
            it('test2b', () => test([[5,6],[3,3]], [3,3], Face.interior));
            it('test3',  () => test([[2,4],[4,6]], [3,5], Face.exterior));
            it('test3b', () => test([[4,6],[2,4]], [3,5], Face.interior));
            it('test4',  () => test([[4,4],[8,5]], null));
            it('test5',  () => test([[-3,3],[1,4]], null));
            it('test5',  () => test([[1,1],[5,1]], null));
        });      
        describe('horizontal down ray', () => {
            beforeEach(() => {
                ray = makeRay([3,5],[0,-3]);
            });
            it('test1',  () => test([[1,6],[5,6]], null));
            it('test2',  () => test([[1,1],[5,1]], [3,1], Face.interior));
            it('test2b', () => test([[5,1],[1,1]], [3,1], Face.exterior));
        });   
        describe('tests', () => {
            beforeEach(() => {
                ray = makeRay([0,0], [1,1]);                
            })
            it('test1', () => test([[0,2],[2,0]], [1,1], Face.exterior));
            it('test1', () => test([[2,0],[0,2]], [1,1], Face.interior));
        });
        
    });

    describe('distance point <> segment tests', () => {  
        const test = (p: Vector, s: ILineSegment)=> distanceTo(p, s);        
        
        it('test1', () => expect(test([0,0], [[0,0],[1,0]])).toBe(0));
        it('test2', () => expect(test([0.5,0], [[0,0],[1,0]])).toBe(0));
        it('test3', () => expect(test([0,1], [[0,0],[1,0]])).toBe(1));
        it('test4', () => expect(test([0.5,1], [[0,0],[1,0]])).toBe(1));
        it('test5', () => expect(test([1,1], [[0,0],[1,0]])).toBe(1));        
        it('test6', () => expect(test([-1,0], [[0,0],[1,0]])).toBe(1));

        it('test7', () => expect(test([0,0], [[0,0],[1,1]])).toBe(0));
        it('test8', () => expect(test([1/2,1/2], [[0,0],[1,1]])).toBe(0));
        it('test9', () => expect(test([1,1], [[0,0],[1,1]])).toBe(0));        
        it('test0', () => expect(test([-1,-1], [[0,0],[1,1]])).toBe(Math.sqrt(2)));        
    });

    describe('project point on segment tests', () => {  
        const test = (p: Vector, s: ILineSegment)=> projectOn(p, s);        
        
        it('test1', () => expect(test([0,0], [[0,0],[1,0]])).toEqual([0,0]));
        it('test2', () => expect(test([0.5,0], [[0,0],[1,0]])).toEqual([0.5,0]));
        it('test3', () => expect(test([0,1], [[0,0],[1,0]])).toEqual([0,0]));
        // it('test4', () => expect(test([0.5,1], [[0,0],[1,0]])).toBe(1));
        // it('test5', () => expect(test([1,1], [[0,0],[1,0]])).toBe(1));        
        // it('test6', () => expect(test([-1,0], [[0,0],[1,0]])).toBe(1));

        // it('test7', () => expect(test([0,0], [[0,0],[1,1]])).toBe(0));
        // it('test8', () => expect(test([1/2,1/2], [[0,0],[1,1]])).toBe(0));
        // it('test9', () => expect(test([1,1], [[0,0],[1,1]])).toBe(0));        
        // it('test0', () => expect(test([-1,-1], [[0,0],[1,1]])).toBe(Math.sqrt(2)));        
    });

    describe('midpoint tests', () => {
        it('midpoint of horizontal segment', () => 
            expect(midpoint([[0, 0], [10, 0]])).toEqual([5, 0]));
        it('midpoint of vertical segment', () => 
            expect(midpoint([[0, 0], [0, 10]])).toEqual([0, 5]));
        it('midpoint of diagonal segment', () => 
            expect(midpoint([[0, 0], [10, 10]])).toEqual([5, 5]));
        it('midpoint with negative coordinates', () => 
            expect(midpoint([[-10, -10], [10, 10]])).toEqual([0, 0]));
        it('midpoint of unit segment', () => 
            expect(midpoint([[0, 0], [1, 1]])).toEqual([0.5, 0.5]));
    });

    describe('slope tests', () => {
        it('slope of horizontal segment is 0', () => 
            expect(slope([[0, 0], [10, 0]])).toBe(0));
        it('slope of 45-degree segment is 1', () => 
            expect(slope([[0, 0], [10, 10]])).toBe(1));
        it('slope of -45-degree segment is -1', () => 
            expect(slope([[0, 10], [10, 0]])).toBe(-1));
        it('slope of vertical segment is Infinity', () => 
            expect(slope([[0, 0], [0, 10]])).toBe(Infinity));
        it('slope of steep segment', () => 
            expect(slope([[0, 0], [1, 5]])).toBe(5));
        it('slope of gentle segment', () => 
            expect(slope([[0, 0], [5, 1]])).toBe(0.2));
    });

    describe('lineAngle tests', () => {
        it('angle between parallel segments is 0', () => 
            expect(lineAngle([[0, 0], [1, 0]], [[0, 0], [2, 0]])).toBeCloseTo(0));
        it('angle between perpendicular segments is pi/2', () => 
            expect(lineAngle([[0, 0], [1, 0]], [[0, 0], [0, 1]])).toBeCloseTo(Math.PI / 2));
        it('angle between opposite segments is pi', () => 
            expect(lineAngle([[0, 0], [1, 0]], [[0, 0], [-1, 0]])).toBeCloseTo(Math.PI));
        it('angle of 45 degrees', () => 
            expect(lineAngle([[0, 0], [1, 0]], [[0, 0], [1, 1]])).toBeCloseTo(Math.PI / 4));
        it('negative angle (clockwise)', () => 
            expect(lineAngle([[0, 0], [1, 0]], [[0, 0], [1, -1]])).toBeCloseTo(-Math.PI / 4));
    });

    describe('segmentLength tests', () => {
        it('length of unit horizontal segment', () => 
            expect(segmentLength([[0, 0], [1, 0]])).toBe(1));
        it('length of unit vertical segment', () => 
            expect(segmentLength([[0, 0], [0, 1]])).toBe(1));
        it('length of 3-4-5 triangle hypotenuse', () => 
            expect(segmentLength([[0, 0], [3, 4]])).toBe(5));
        it('length of zero-length segment', () => 
            expect(segmentLength([[5, 5], [5, 5]])).toBe(0));
        it('length with negative coordinates', () => 
            expect(segmentLength([[-3, -4], [0, 0]])).toBe(5));
    });

    describe('normal tests', () => {
        it('normal of horizontal segment points up', () => {
            const n = normal([[0, 0], [10, 0]]);
            expect(n[0]).toEqual([5, 0]); // midpoint
            expect(n[1][0]).toBeCloseTo(5); // x stays at midpoint
            expect(n[1][1]).toBeCloseTo(1); // y goes up by 1 (unit normal)
        });
        it('normal of vertical segment points left', () => {
            const n = normal([[0, 0], [0, 10]]);
            expect(n[0]).toEqual([0, 5]); // midpoint
            expect(n[1][0]).toBeCloseTo(-1); // x goes left by 1
            expect(n[1][1]).toBeCloseTo(5); // y stays at midpoint
        });
        it('normal with custom scale', () => {
            const n = normal([[0, 0], [10, 0]], 5);
            expect(n[0]).toEqual([5, 0]); // midpoint
            expect(n[1][1]).toBeCloseTo(5); // y goes up by 5
        });
    });

    describe('lineIntersect tests', () => {
        it('perpendicular lines at origin', () => {
            const result = lineIntersect([[0, 0], [1, 0]], [[0, 0], [0, 1]]);
            expect(result[0]).toBeCloseTo(0);
            expect(result[1]).toBeCloseTo(0);
        });
        it('perpendicular lines offset from origin', () => {
            const result = lineIntersect([[0, 5], [10, 5]], [[5, 0], [5, 10]]);
            expect(result[0]).toBeCloseTo(5);
            expect(result[1]).toBeCloseTo(5);
        });
        it('diagonal lines crossing', () => {
            const result = lineIntersect([[0, 0], [10, 10]], [[0, 10], [10, 0]]);
            expect(result[0]).toBeCloseTo(5);
            expect(result[1]).toBeCloseTo(5);
        });
        it('parallel lines return non-finite values (degenerate case)', () => {
            const result = lineIntersect([[0, 0], [10, 0]], [[0, 5], [10, 5]]);
            // Parallel horizontal lines: denominator is 0, resulting in division by zero
            expect(isFinite(result[0])).toBe(false);
            expect(isFinite(result[1])).toBe(false);
        });
    });

    describe('distanceToMidPoint tests', () => {
        it('point at midpoint has zero distance', () => 
            expect(distanceToMidPoint([5, 0], [[0, 0], [10, 0]])).toBe(0));
        it('point above midpoint', () => 
            expect(distanceToMidPoint([5, 3], [[0, 0], [10, 0]])).toBe(3));
        it('point at segment start', () => 
            expect(distanceToMidPoint([0, 0], [[0, 0], [10, 0]])).toBe(5));
        it('point at segment end', () => 
            expect(distanceToMidPoint([10, 0], [[0, 0], [10, 0]])).toBe(5));
        it('diagonal distance to midpoint', () => 
            expect(distanceToMidPoint([0, 0], [[6, 0], [6, 8]])).toBe(Math.sqrt(36 + 16)));
    });
});