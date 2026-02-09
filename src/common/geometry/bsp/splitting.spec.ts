import { splitPolygon } from './splitting';
import { createPolygon } from '../polygon';
import { createPlane } from '../../math/plane';

describe('splitting', () => {
    describe('splitPolygon', () => {
        it('splits a square into two closed polygons with a vertical plane', () => {
            // Create a square: (0,0) -> (2,0) -> (2,2) -> (0,2)
            const square = createPolygon([[0, 0], [2, 0], [2, 2], [0, 2]]);
            
            // Vertical plane at x=1 (line segment from (1,0) to (1,2))
            const verticalPlane = createPlane([[1, 0], [1, 2]]);
            
            const [front, back] = splitPolygon(square, verticalPlane);
            
            // Both resulting polygons should be valid (have vertices and edges)
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
            
            // Both polygons should be closed (last edge ends where first edge starts)
            expect(front.edges[front.edges.length - 1].end).toBe(front.edges[0].start);
            expect(back.edges[back.edges.length - 1].end).toBe(back.edges[0].start);
            
            // Each half should be a rectangle with 4 vertices
            expect(front.vertices.length).toBe(4);
            expect(back.vertices.length).toBe(4);
        });
    });
});
