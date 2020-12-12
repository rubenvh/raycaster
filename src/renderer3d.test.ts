import { determineLight } from './renderer3d';
import { Vector } from './math/vector';
import { makeEdge } from './geometry/edge';

describe('renderer3d tests', () => {
    describe('light intensity tests', () => {  
        const test = (e: [Vector, Vector]) => determineLight({edge: makeEdge(...e), distance: 0, intersection: null, polygon: null, ray: null});
        it('horizontal edge => 100', () => expect(test([[0,0],[1,0]])).toBe(100));
        it('vertical edge => 255', () => expect(test([[0,0],[0,1]])).toBe(255));
        it('edge with slope 1 => ', () => expect(test([[0,0],[1,1]])).toBe(100+(255-100)/2));
        it('edge with slope -1', () => expect(test([[0,1],[1,0]])).toBe(100+(255-100)/2));
    });
});