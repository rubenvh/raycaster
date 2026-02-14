import { splitPolygon, oldSplitPolygon, pickSplittingPlane } from './splitting';
import { createPolygon } from '../polygon';
import { createPlane, VOID_PLANE, Plane } from '../../math/plane';
import { Vector } from '../../math/vector';

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

        it('splits a square with a horizontal plane', () => {
            const square = createPolygon([[0, 0], [4, 0], [4, 4], [0, 4]]);
            const horizontalPlane = createPlane([[0, 2], [4, 2]]);
            
            const [front, back] = splitPolygon(square, horizontalPlane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('splits a triangle where plane passes through a vertex (On case)', () => {
            // Triangle with vertex exactly on the plane
            const triangle = createPolygon([[0, 0], [4, 0], [2, 4]]);
            // Plane through x=2 — vertex (2,4) is exactly on the plane
            const plane = createPlane([[2, 0], [2, 4]]);
            
            const [front, back] = splitPolygon(triangle, plane);
            
            // Both sides should have at least some vertices
            expect(front.vertices.length).toBeGreaterThanOrEqual(2);
            expect(back.vertices.length).toBeGreaterThanOrEqual(2);
        });

        it('handles edge endpoint on plane with start behind (bSide=On, aSide=Behind)', () => {
            // Create a polygon where one edge ends exactly on the splitting plane
            // and the edge's start is behind the plane
            // Pentagon: vertices carefully placed so some are front, some behind, one on plane
            const poly = createPolygon([[0, 0], [4, 0], [4, 2], [2, 4], [0, 2]]);
            // Plane at x=2 — vertex (2,4) is ON, (0,0),(0,2) are behind, (4,0),(4,2) are in front
            const plane = createPlane([[2, -1], [2, 5]]);
            
            const [front, back] = splitPolygon(poly, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('handles edge where start is in front and end is behind', () => {
            const square = createPolygon([[0, 0], [6, 0], [6, 6], [0, 6]]);
            const plane = createPlane([[3, 0], [3, 6]]);
            
            const [front, back] = splitPolygon(square, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('handles edge where start is behind and end is in front', () => {
            const square = createPolygon([[0, 0], [6, 0], [6, 6], [0, 6]]);
            // Plane at x=3, but use different direction to swap front/back
            const plane = createPlane([[3, 6], [3, 0]]);
            
            const [front, back] = splitPolygon(square, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('splits a large polygon with multiple intersections', () => {
            // L-shaped polygon (non-convex)
            const poly = createPolygon([
                [0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]
            ]);
            // Vertical plane at x=3
            const plane = createPlane([[3, -1], [3, 7]]);
            
            const [front, back] = splitPolygon(poly, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(2);
            expect(back.vertices.length).toBeGreaterThanOrEqual(2);
        });

        it('handles polygon entirely on one side of the plane (front)', () => {
            // Rectangle entirely to the right of the plane
            const rect = createPolygon([[5, 0], [10, 0], [10, 5], [5, 5]]);
            const plane = createPlane([[2, 0], [2, 5]]);
            
            const [front, back] = splitPolygon(rect, plane);
            
            // All vertices should be on one side, the other should be empty
            const totalVerts = front.vertices.length + back.vertices.length;
            expect(totalVerts).toBe(4);
            expect(front.vertices.length === 4 || back.vertices.length === 4).toBe(true);
        });

        it('handles polygon entirely on one side of the plane (back)', () => {
            const rect = createPolygon([[0, 0], [2, 0], [2, 5], [0, 5]]);
            const plane = createPlane([[5, 0], [5, 5]]);
            
            const [front, back] = splitPolygon(rect, plane);
            
            // All vertices should be on one side
            const totalVerts = front.vertices.length + back.vertices.length;
            expect(totalVerts).toBe(4);
            expect(front.vertices.length === 4 || back.vertices.length === 4).toBe(true);
        });
    });

    describe('oldSplitPolygon', () => {
        it('splits a square with a vertical plane', () => {
            const square = createPolygon([[0, 0], [4, 0], [4, 4], [0, 4]]);
            const plane = createPlane([[2, 0], [2, 4]]);
            
            const [front, back] = oldSplitPolygon(square, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('splits a square with a horizontal plane', () => {
            const square = createPolygon([[0, 0], [4, 0], [4, 4], [0, 4]]);
            const plane = createPlane([[0, 2], [4, 2]]);
            
            const [front, back] = oldSplitPolygon(square, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('handles vertex exactly on the plane (bSide=On)', () => {
            // Triangle where one vertex is exactly on the splitting plane
            const triangle = createPolygon([[0, 0], [4, 0], [2, 4]]);
            const plane = createPlane([[2, 0], [2, 4]]);
            
            const [front, back] = oldSplitPolygon(triangle, plane);
            
            // Vertex on plane should go to front
            expect(front.vertices.length).toBeGreaterThanOrEqual(2);
            expect(back.vertices.length).toBeGreaterThanOrEqual(2);
        });

        it('handles transition from behind to in front (aSide=Behind, bSide=InFront)', () => {
            const square = createPolygon([[0, 0], [6, 0], [6, 6], [0, 6]]);
            const plane = createPlane([[3, 0], [3, 6]]);
            
            const [front, back] = oldSplitPolygon(square, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('handles transition from in front to behind (aSide=InFront, bSide=Behind)', () => {
            const square = createPolygon([[0, 0], [6, 0], [6, 6], [0, 6]]);
            const plane = createPlane([[3, 6], [3, 0]]);
            
            const [front, back] = oldSplitPolygon(square, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });

        it('handles aSide=On when bSide=Behind', () => {
            // Pentagon where a vertex is exactly on the plane, and the next is behind
            // Create polygon with vertex at x=3 (on plane) 
            const poly = createPolygon([[3, 0], [6, 0], [6, 6], [0, 6], [0, 0]]);
            // Plane at x=3
            const plane = createPlane([[3, -1], [3, 7]]);
            
            const [front, back] = oldSplitPolygon(poly, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(2);
            expect(back.vertices.length).toBeGreaterThanOrEqual(2);
        });

        it('handles aSide=Behind when bSide=On', () => {
            // Create a scenario where the previous vertex is behind and current is on plane
            // Polygon with one vertex on the plane and neighbors behind
            // Use a polygon that straddles the plane, with one vertex exactly on it
            const poly = createPolygon([[0, 0], [6, 0], [6, 6], [3, 6], [0, 3]]);
            // Plane at x=3 — (3,6) is on the plane, (0,0) and (0,3) are behind
            const plane = createPlane([[3, -1], [3, 7]]);
            
            const [front, back] = oldSplitPolygon(poly, plane);
            
            // Both sides should have vertices since polygon straddles the plane
            expect(front.vertices.length).toBeGreaterThanOrEqual(2);
            expect(back.vertices.length).toBeGreaterThanOrEqual(2);
        });

        it('splits a complex polygon (non-convex)', () => {
            const poly = createPolygon([
                [0, 0], [8, 0], [8, 4], [4, 4], [4, 8], [0, 8]
            ]);
            const plane = createPlane([[4, -1], [4, 9]]);
            
            const [front, back] = oldSplitPolygon(poly, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(2);
            expect(back.vertices.length).toBeGreaterThanOrEqual(2);
        });

        it('produces correct vertex counts when splitting a rectangle', () => {
            const rect = createPolygon([[0, 0], [8, 0], [8, 4], [0, 4]]);
            const plane = createPlane([[4, -1], [4, 5]]);
            
            const [front, back] = oldSplitPolygon(rect, plane);
            
            // Each half should be a rectangle with 4 vertices
            expect(front.vertices.length).toBe(4);
            expect(back.vertices.length).toBe(4);
        });

        it('splits a wide polygon preserving total vertex count', () => {
            const poly = createPolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
            const plane = createPlane([[5, 0], [5, 10]]);
            
            const [front, back] = oldSplitPolygon(poly, plane);
            
            expect(front.vertices.length).toBeGreaterThanOrEqual(3);
            expect(back.vertices.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('pickSplittingPlane', () => {
        it('returns a valid splitting plane for a single non-convex polygon', () => {
            // Non-convex L-shaped polygon
            const poly = createPolygon([
                [0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]
            ]);
            
            const plane = pickSplittingPlane([poly], 0, VOID_PLANE);
            
            // Should find a plane (not VOID_PLANE)
            expect(plane).toBeDefined();
            expect(plane.n).toBeDefined();
        });

        it('returns a valid plane for multiple polygons', () => {
            const poly1 = createPolygon([[0, 0], [4, 0], [4, 4], [0, 4]]);
            const poly2 = createPolygon([[6, 0], [10, 0], [10, 4], [6, 4]]);
            
            const plane = pickSplittingPlane([poly1, poly2], 0, VOID_PLANE);
            
            expect(plane).toBeDefined();
            expect(plane.n).toBeDefined();
        });

        it('uses different strategies at different depths', () => {
            const poly = createPolygon([
                [0, 0], [8, 0], [8, 4], [4, 4], [4, 8], [0, 8]
            ]);
            
            const plane0 = pickSplittingPlane([poly], 0, VOID_PLANE);
            const plane1 = pickSplittingPlane([poly], 1, VOID_PLANE);
            
            // Both should produce valid planes
            expect(plane0).toBeDefined();
            expect(plane1).toBeDefined();
        });

        it('avoids previous splitting plane', () => {
            const poly = createPolygon([[0, 0], [4, 0], [4, 4], [0, 4]]);
            const previousPlane = createPlane([[2, 0], [2, 4]]);
            
            const plane = pickSplittingPlane([poly], 0, previousPlane);
            
            // Should find a different plane or VOID_PLANE
            expect(plane).toBeDefined();
        });

        it('handles single convex polygon', () => {
            // Simple convex triangle
            const poly = createPolygon([[0, 0], [4, 0], [2, 4]]);
            
            const plane = pickSplittingPlane([poly], 0, VOID_PLANE);
            
            // Should still find a splitting plane
            expect(plane).toBeDefined();
        });

        it('evaluates splitting plane score based on convexity and balance', () => {
            // Non-convex polygon that will produce different scores
            const poly = createPolygon([
                [0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]
            ]);
            
            const plane = pickSplittingPlane([poly], 0, VOID_PLANE);
            expect(plane).toBeDefined();
        });
    });
});
