import { ILineSegment, distanceTo, projectOn, ILine } from './lineSegment';
import { Vector } from '../math/vector';
import { intersectRay, IRay, makeRay } from '../geometry/collision';

describe('line segment tests', () => {
    describe('ray intersection tests', () => {  
        let ray: IRay;
        const test = (s: ILineSegment, expected: Vector)=> {
            let actual = intersectRay(ray, s);            
            expect(actual).toEqual(expected);
        };

        describe('horizontal up ray', () => {
            beforeEach(() => {
                ray = makeRay([3,2],[0,3]);
            });
            it('test1', () => test([[1,6],[5,6]], [3,6]));
            it('test2', () => test([[3,3],[5,6]], [3,3]));
            it('test3', () => test([[2,4],[4,6]], [3,5]));
            it('test4', () => test([[4,4],[8,5]], null));
            it('test5', () => test([[-3,3],[1,4]], null));
            it('test5', () => test([[1,1],[5,1]], null));
        });      
        describe('horizontal down ray', () => {
            beforeEach(() => {
                ray = makeRay([3,5],[0,-3]);
            });
            it('test1', () => test([[1,6],[5,6]], null));
            it('test2', () => test([[1,1],[5,1]], [3,1]));
            // it('test3', () => test([[2,4],[4,6]], [3,5]));
            // it('test4', () => test([[4,4],[8,5]], null));
            // it('test5', () => test([[-3,3],[1,4]], null));
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
});