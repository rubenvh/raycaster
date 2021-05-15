import { createPolygon } from './../polygon';
import { classifyPointToPlane, classifyPolygonToPlane, createPlane, PointToPlaneRelation, PolygonToPlaneRelation } from "./model";

describe('classification of point in relation to plane', () => {
    const plane =  createPlane([[0,0], [1,1]]);
    it('when point is in front of plane', () => {
        expect(classifyPointToPlane([0, 1], plane)).toBe(PointToPlaneRelation.InFront);                
        expect(classifyPointToPlane([10, 11], plane)).toBe(PointToPlaneRelation.InFront);
    });
    it('when point is behind plane', () => {
        expect(classifyPointToPlane([1, 0], plane)).toBe(PointToPlaneRelation.Behind);
        expect(classifyPointToPlane([10, 9], plane)).toBe(PointToPlaneRelation.Behind);
    });
    it('when point is on plane', () => {
        expect(classifyPointToPlane([-1, -1], plane)).toBe(PointToPlaneRelation.On);
        expect(classifyPointToPlane([0, 0], plane)).toBe(PointToPlaneRelation.On);
        expect(classifyPointToPlane([0.5, 0.5], plane)).toBe(PointToPlaneRelation.On);
        expect(classifyPointToPlane([1, 1], plane)).toBe(PointToPlaneRelation.On);
        expect(classifyPointToPlane([100, 100], plane)).toBe(PointToPlaneRelation.On);
    });
});

describe('classification of polygon in relation to plane', () => {
    const plane =  createPlane([[0,0], [1,1]]);
    it('when polygon is in front of plane', () => {
        expect(classifyPolygonToPlane(createPolygon([[0, 1], [1,2], [-1, 2]]), plane)).toBe(PolygonToPlaneRelation.InFront);                
    });
    it('when polygon is behind plane', () => {
        expect(classifyPolygonToPlane(createPolygon([[1, 0], [2, 1], [2, -1]]), plane)).toBe(PolygonToPlaneRelation.Behind);
    });
    it('when polygon is coplanar with plane', () => {
        expect(classifyPolygonToPlane(createPolygon([[0, 0], [1, 1], [2, 2]]), plane)).toBe(PolygonToPlaneRelation.Coplanar);
    });
    it('when polygon is straddling plane', () => {
        expect(classifyPolygonToPlane(createPolygon([[0, 1], [2, 0], [1, -1]]), plane)).toBe(PolygonToPlaneRelation.Straddling);
    });
});

