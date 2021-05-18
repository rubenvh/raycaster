import { createPlane, Plane } from '../math/plane';
import { makeRay, intersectRayPlane } from './collision';
import { Face } from './properties';
describe('collison tests', () => {
    it('intersecting ray with plane tests', () => {
        expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[-10,20],[0,10]]))).toEqual({point: [5,5], face: Face.interior});
        expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[2,-2],[2,0]]))).toEqual({point: [2,2], face: Face.exterior});
        expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[2,0],[2,-2]]))).toEqual({point: [2,2], face: Face.interior});
        expect(intersectRayPlane(makeRay([1,1], [0,0]), createPlane([[0,10],[10,0]]))).toBeNull();
        expect(intersectRayPlane(makeRay([0,0], [1,1]), createPlane([[0,10],[10,20]]))).toBeNull();        

        expect(intersectRayPlane(makeRay([0,0], [-1/2,1]), createPlane([[-10,20],[0,10]]))).toEqual({point: [-10,20], face: Face.interior});
    });
});