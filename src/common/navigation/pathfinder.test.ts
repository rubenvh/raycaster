import { findPath, findPathBetweenPositions } from './pathfinder';
import { NavGraph, NavNode, EMPTY_PATH } from './model';
import { Vector } from '../math/vector';
import { geometries, resetTestRandom } from '../testing/factories';
import { buildNavGraph, findNearestNode } from './nav-graph';

beforeEach(() => resetTestRandom());

/** Build a simple manual nav-graph for controlled testing */
function buildSimpleGraph(): NavGraph {
    // Linear graph: 0 -- 1 -- 2 -- 3
    const nodes: NavNode[] = [
        { id: 0, position: [0, 0], neighbors: [1], distances: [10] },
        { id: 1, position: [10, 0], neighbors: [0, 2], distances: [10, 10] },
        { id: 2, position: [20, 0], neighbors: [1, 3], distances: [10, 10] },
        { id: 3, position: [30, 0], neighbors: [2], distances: [10] },
    ];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return { nodes, nodeMap, cellSize: 10, bounds: [40, 10] as Vector };
}

/** Build a graph with a branch */
function buildBranchedGraph(): NavGraph {
    //     1
    //    / \
    //   0   3
    //    \ /
    //     2
    const nodes: NavNode[] = [
        { id: 0, position: [0, 10], neighbors: [1, 2], distances: [14.14, 14.14] },
        { id: 1, position: [10, 0], neighbors: [0, 3], distances: [14.14, 14.14] },
        { id: 2, position: [10, 20], neighbors: [0, 3], distances: [14.14, 14.14] },
        { id: 3, position: [20, 10], neighbors: [1, 2], distances: [14.14, 14.14] },
    ];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return { nodes, nodeMap, cellSize: 10, bounds: [30, 30] as Vector };
}

describe('pathfinder', () => {

    // ========================================================================
    // findPath
    // ========================================================================

    describe('findPath', () => {
        it('should find path between adjacent nodes', () => {
            const graph = buildSimpleGraph();
            const path = findPath(graph, 0, 1);
            expect(path.waypoints.length).toBe(2);
            expect(path.nodeIds).toEqual([0, 1]);
            expect(path.totalLength).toBeCloseTo(10);
        });

        it('should find path across multiple nodes', () => {
            const graph = buildSimpleGraph();
            const path = findPath(graph, 0, 3);
            expect(path.waypoints.length).toBe(4);
            expect(path.nodeIds).toEqual([0, 1, 2, 3]);
            expect(path.totalLength).toBeCloseTo(30);
        });

        it('should return single-node path for same start and goal', () => {
            const graph = buildSimpleGraph();
            const path = findPath(graph, 2, 2);
            expect(path.waypoints.length).toBe(1);
            expect(path.totalLength).toBe(0);
        });

        it('should return EMPTY_PATH for non-existent nodes', () => {
            const graph = buildSimpleGraph();
            expect(findPath(graph, 0, 99)).toBe(EMPTY_PATH);
            expect(findPath(graph, 99, 0)).toBe(EMPTY_PATH);
        });

        it('should find path in branched graph', () => {
            const graph = buildBranchedGraph();
            const path = findPath(graph, 0, 3);
            expect(path.waypoints.length).toBe(3); // 0 → 1 → 3 or 0 → 2 → 3
            expect(path.nodeIds[0]).toBe(0);
            expect(path.nodeIds[path.nodeIds.length - 1]).toBe(3);
        });

        it('should respect maxIterations limit', () => {
            const graph = buildSimpleGraph();
            // With maxIterations=1, the pathfinder should not find the path from 0 to 3
            const path = findPath(graph, 0, 3, { maxIterations: 1 });
            // It might find the first hop or return empty
            expect(path.nodeIds.length).toBeLessThanOrEqual(2);
        });

        it('should return EMPTY_PATH for disconnected nodes', () => {
            // Create a graph with disconnected components
            const nodes: NavNode[] = [
                { id: 0, position: [0, 0], neighbors: [1], distances: [10] },
                { id: 1, position: [10, 0], neighbors: [0], distances: [10] },
                { id: 2, position: [100, 100], neighbors: [3], distances: [10] },
                { id: 3, position: [110, 100], neighbors: [2], distances: [10] },
            ];
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const graph: NavGraph = { nodes, nodeMap, cellSize: 10, bounds: [120, 110] as Vector };
            const path = findPath(graph, 0, 3);
            expect(path).toBe(EMPTY_PATH);
        });
    });

    // ========================================================================
    // findPathBetweenPositions
    // ========================================================================

    describe('findPathBetweenPositions', () => {
        it('should find path between world positions by snapping to nearest nodes', () => {
            const graph = buildSimpleGraph();
            const path = findPathBetweenPositions(graph, [2, 0], [28, 0], findNearestNode);
            expect(path.waypoints.length).toBeGreaterThan(0);
            expect(path.nodeIds[0]).toBe(0); // Nearest to [2,0] is node 0 at [0,0]
            expect(path.nodeIds[path.nodeIds.length - 1]).toBe(3); // Nearest to [28,0] is node 3 at [30,0]
        });

        it('should return EMPTY_PATH if no nearest nodes found', () => {
            const graph: NavGraph = { nodes: [], nodeMap: new Map(), cellSize: 10, bounds: [0, 0] as Vector };
            const path = findPathBetweenPositions(graph, [50, 50], [100, 100], findNearestNode);
            expect(path).toBe(EMPTY_PATH);
        });
    });

    // ========================================================================
    // Integration: buildNavGraph + findPath
    // ========================================================================

    describe('integration with nav-graph builder', () => {
        it('should find path through geometry-based nav graph', () => {
            const geometry = geometries.rectangle(0, 0, 300, 300);
            const graph = buildNavGraph(geometry, 30);
            expect(graph.nodes.length).toBeGreaterThan(2);

            // Find path between two walkable nodes
            const startNode = graph.nodes[0];
            const endNode = graph.nodes[graph.nodes.length - 1];
            const path = findPath(graph, startNode.id, endNode.id);
            expect(path.waypoints.length).toBeGreaterThan(0);
            expect(path.totalLength).toBeGreaterThan(0);
        });
    });
});
