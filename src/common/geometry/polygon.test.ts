import { createPolygon, IPolygon, isConvex } from './polygon';

describe('polygon tests', () => {
    describe('isConvex', () => {
        const invokeSut = (polygon: IPolygon) => isConvex(polygon);

        describe('convex polygons return true', () => {
            it('any triangle is always convex', () => {                
                expect(invokeSut(createPolygon([[0,0], [0,1], [1,0]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0], [1,0], [0,1]]))).toBe(true);
                expect(invokeSut(createPolygon([[5,2], [7,1], [-10,7]]))).toBe(true);                
            }); 
            it('rectangles are always convex', () => {                
                expect(invokeSut(createPolygon([[0,0],[0,1],[1,1],[1,0]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0],[0,8],[4,8],[4,0]]))).toBe(true);
            });            
            it('rectangles are always convex - reversed', () => {
                expect(invokeSut(createPolygon([[0,0],[1,0],[1,1],[0,1]]))).toBe(true);
            });
            it('colinear splits do not make polygons concave - horizontal split', () => {                                
                expect(invokeSut(createPolygon([[0,0], [0,1], [1,1],[2,1],[2,0]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0], [0,1], [2,1],[2,0],[1,0]]))).toBe(true);
            }); 
            it('colinear splits do not make polygons concave - vertical split', () => {                
                expect(invokeSut(createPolygon([[0,0],[2,0],[2,1],[2,2],[0,2]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0], [0,1], [0,2],[2,2],[2,0]]))).toBe(true);
            });            
            
        });

        describe('concave polygons return false', () => {
            it('vierhoek', () => {                
                expect(invokeSut(createPolygon([[1,1],[0,1],[5,5],[1,0]]))).toBe(false);
                // reversed:
                expect(invokeSut(createPolygon([[1,1],[1,0],[5,5],[0,1]]))).toBe(false);
            }); 
            it('vijfhoek', () => {                
                expect(invokeSut(createPolygon([[0,0],[0,2],[1,1],[2,2],[2,0]]))).toBe(false);
                // reversed:
                expect(invokeSut(createPolygon([[0,0],[2,0],[2,2],[1,1],[0,2]]))).toBe(false);
            }); 
        });
    });    
});
  