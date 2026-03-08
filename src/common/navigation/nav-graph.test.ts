import { isPointInPolygon, segmentsIntersect, isWalkable, hasLineOfSight, buildNavGraph, findNearestNode, collectSolidEdges } from './nav-graph';
import { Vector } from '../math/vector';
import { edges, polygons, geometries, resetTestRandom } from '../testing/factories';

beforeEach(() => resetTestRandom());

describe('nav-graph', () => {

    // ========================================================================
    // segmentsIntersect
    // ========================================================================

    describe('segmentsIntersect', () => {
        it('should detect crossing segments', () => {
            expect(segmentsIntersect([0, 0], [10, 10], [10, 0], [0, 10])).toBe(true);
        });

        it('should not detect parallel segments', () => {
            expect(segmentsIntersect([0, 0], [10, 0], [0, 5], [10, 5])).toBe(false);
        });

        it('should not detect non-overlapping segments', () => {
            expect(segmentsIntersect([0, 0], [5, 0], [6, 0], [10, 0])).toBe(false);
        });

        it('should not detect touching at endpoints (within epsilon)', () => {
            // Segments that share an endpoint should NOT count as intersecting
            expect(segmentsIntersect([0, 0], [5, 5], [5, 5], [10, 0])).toBe(false);
        });

        it('should detect T-intersection where one segment crosses the other', () => {
            expect(segmentsIntersect([0, 5], [10, 5], [5, 0], [5, 10])).toBe(true);
        });
    });

    // ========================================================================
    // isPointInPolygon
    // ========================================================================

    describe('isPointInPolygon', () => {
        it('should detect point inside a square polygon', () => {
            const poly = polygons.rectangle(0, 0, 100, 100);
            expect(isPointInPolygon([50, 50], poly)).toBe(true);
        });

        it('should detect point outside a square polygon', () => {
            const poly = polygons.rectangle(0, 0, 100, 100);
            expect(isPointInPolygon([150, 50], poly)).toBe(false);
        });

        it('should handle point outside the bounds entirely', () => {
            const poly = polygons.rectangle(0, 0, 100, 100);
            expect(isPointInPolygon([-50, -50], poly)).toBe(false);
        });
    });

    // ========================================================================
    // collectSolidEdges
    // ========================================================================

    describe('collectSolidEdges', () => {
        it('should collect only non-immaterial edges', () => {
            const geometry = geometries.rectangle(0, 0, 100, 100);
            const solidEdges = collectSolidEdges(geometry);
            // A rectangle has 4 edges, all solid by default
            expect(solidEdges.length).toBe(4);
            solidEdges.forEach(e => expect(e.immaterial).toBeFalsy());
        });
    });

    // ========================================================================
    // isWalkable
    // ========================================================================

    describe('isWalkable', () => {
        it('should return true for point far from walls', () => {
            const solidEdges = [edges.horizontal(0, 0, 100)];
            // Point is 50 units from the wall — well above clearance
            expect(isWalkable([50, 50], solidEdges, 5)).toBe(true);
        });

        it('should return false for point too close to a wall', () => {
            const solidEdges = [edges.horizontal(0, 0, 100)];
            // Point is 2 units from the wall — below clearance of 5
            expect(isWalkable([50, 2], solidEdges, 5)).toBe(false);
        });

        it('should return true for empty geometry', () => {
            expect(isWalkable([50, 50], [], 5)).toBe(true);
        });
    });

    // ========================================================================
    // hasLineOfSight
    // ========================================================================

    describe('hasLineOfSight', () => {
        it('should return true when no walls block the path', () => {
            const solidEdges = [edges.vertical(200, 0, 100)];
            // Path from (50,50) to (100,50) doesn't cross the wall at x=200
            expect(hasLineOfSight([50, 50], [100, 50], solidEdges)).toBe(true);
        });

        it('should return false when a wall blocks the path', () => {
            const solidEdges = [edges.vertical(75, 0, 100)];
            // Path from (50,50) to (100,50) crosses the wall at x=75
            expect(hasLineOfSight([50, 50], [100, 50], solidEdges)).toBe(false);
        });

        it('should return true for zero-length path', () => {
            const solidEdges = [edges.vertical(75, 0, 100)];
            expect(hasLineOfSight([50, 50], [50, 50], solidEdges)).toBe(true);
        });

        it('should return false when path grazes too close to a wall', () => {
            // Wall runs vertically at x=50 from y=0 to y=40.
            // Path travels from (45, 50) to (55, 50) — the center line doesn't
            // cross the wall (it ends at y=40) but passes within 2 units of the
            // wall endpoint, which is below the default clearance of 5.
            const solidEdges = [edges.vertical(50, 0, 48)];
            // Path from (45, 50) to (55, 50) — goes right past the end of the wall
            // The midpoint (50, 50) is only 2 units from the wall endpoint at (50, 48)
            expect(hasLineOfSight([45, 50], [55, 50], solidEdges, 5)).toBe(false);
        });

        it('should return true when path keeps adequate clearance from wall end', () => {
            // Wall at x=50 from y=0 to y=40.  Path travels at y=60, which is
            // 20 units from the wall endpoint — well above clearance.
            const solidEdges = [edges.vertical(50, 0, 40)];
            expect(hasLineOfSight([30, 60], [70, 60], solidEdges, 5)).toBe(true);
        });

        it('should respect custom clearance parameter', () => {
            // Wall at x=50, y=[0,48].  Point at (50,50) is 2 units from wall end.
            const solidEdges = [edges.vertical(50, 0, 48)];
            // With clearance=1 the 2-unit gap is sufficient
            expect(hasLineOfSight([45, 50], [55, 50], solidEdges, 1)).toBe(true);
            // With clearance=5 the 2-unit gap is NOT sufficient
            expect(hasLineOfSight([45, 50], [55, 50], solidEdges, 5)).toBe(false);
        });
    });

    // ========================================================================
    // buildNavGraph
    // ========================================================================

    describe('buildNavGraph', () => {
        it('should return empty graph for empty geometry', () => {
            const geometry = geometries.empty();
            const graph = buildNavGraph(geometry);
            expect(graph.nodes.length).toBe(0);
        });

        it('should build graph with walkable nodes for open geometry', () => {
            // Create a large rectangle — interior should have walkable nodes
            const geometry = geometries.rectangle(0, 0, 300, 300);
            const graph = buildNavGraph(geometry, 30);
            // Should have at least some walkable nodes in the interior
            expect(graph.nodes.length).toBeGreaterThan(0);
        });

        it('should connect adjacent walkable nodes', () => {
            const geometry = geometries.rectangle(0, 0, 300, 300);
            const graph = buildNavGraph(geometry, 30);
            // At least some nodes should have neighbors
            const connectedNodes = graph.nodes.filter(n => n.neighbors.length > 0);
            expect(connectedNodes.length).toBeGreaterThan(0);
        });

        it('should store nodes in nodeMap for O(1) lookup', () => {
            const geometry = geometries.rectangle(0, 0, 300, 300);
            const graph = buildNavGraph(geometry, 30);
            for (const node of graph.nodes) {
                expect(graph.nodeMap.get(node.id)).toBe(node);
            }
        });

        it('should not allow diagonal connections that cut through wall corners', () => {
            // Build a geometry where two walls meet at a grid corner, creating
            // a configuration where a diagonal move would pass through the gap.
            //
            // Setup: Large bounding area with two walls arranged so that the
            // cells at (row+1, col) and (row, col+1) are blocked but (row, col)
            // and (row+1, col+1) are walkable. A diagonal from (row,col) to
            // (row+1,col+1) should be prevented.
            //
            // We use a 300×300 rectangle with an internal wall arrangement.
            // Two short walls placed to block specific cardinal neighbors:
            //   Wall A blocks the cell below node A (cardinal direction)
            //   Wall B blocks the cell to the right of node A (cardinal direction)
            // The diagonal (down-right) should be blocked even if it doesn't
            // cross either wall.
            const geometry = geometries.rectangle(0, 0, 300, 300);
            const graph = buildNavGraph(geometry, 30);

            // All nodes should have symmetric connections: if A→B exists, B→A exists
            for (const node of graph.nodes) {
                for (const neighborId of node.neighbors) {
                    const neighbor = graph.nodeMap.get(neighborId)!;
                    expect(neighbor.neighbors).toContain(node.id);
                }
            }
        });

        it('should assign correct distances to neighbor connections', () => {
            const geometry = geometries.rectangle(0, 0, 300, 300);
            const graph = buildNavGraph(geometry, 30);

            for (const node of graph.nodes) {
                for (let i = 0; i < node.neighbors.length; i++) {
                    const neighbor = graph.nodeMap.get(node.neighbors[i])!;
                    const dx = node.position[0] - neighbor.position[0];
                    const dy = node.position[1] - neighbor.position[1];
                    const expectedDist = Math.sqrt(dx * dx + dy * dy);
                    expect(node.distances[i]).toBeCloseTo(expectedDist, 5);
                }
            }
        });
    });

    // ========================================================================
    // findNearestNode
    // ========================================================================

    describe('findNearestNode', () => {
        it('should return null for empty graph', () => {
            const graph = { nodes: [], nodeMap: new Map(), cellSize: 30, bounds: [0, 0] as Vector };
            expect(findNearestNode([50, 50], graph)).toBeNull();
        });

        it('should find the closest node to a position', () => {
            const geometry = geometries.rectangle(0, 0, 300, 300);
            const graph = buildNavGraph(geometry, 30);
            const nearest = findNearestNode([150, 150], graph);
            expect(nearest).not.toBeNull();
            // The nearest node should be close to center
            expect(Math.abs(nearest!.position[0] - 150)).toBeLessThan(30);
            expect(Math.abs(nearest!.position[1] - 150)).toBeLessThan(30);
        });
    });
});
