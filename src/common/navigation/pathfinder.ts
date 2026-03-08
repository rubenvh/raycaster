/**
 * A* pathfinding on the navigation graph.
 * 
 * Generic A* implementation that works on any NavGraph.
 * Designed to be reusable by any entity: dance camera, NPCs, enemies, etc.
 */
import { Vector, distance as vecDistance } from '../math/vector';
import { NavGraph, NavNode, NavPath, EMPTY_PATH, PathfindOptions } from './model';

// ============================================================================
// Priority Queue (min-heap for A*)
// ============================================================================

type HeapEntry = { nodeId: number; priority: number };

class MinHeap {
    private data: HeapEntry[] = [];

    get size(): number { return this.data.length; }

    push(nodeId: number, priority: number): void {
        this.data.push({ nodeId, priority });
        this.bubbleUp(this.data.length - 1);
    }

    pop(): HeapEntry | undefined {
        if (this.data.length === 0) return undefined;
        const top = this.data[0];
        const last = this.data.pop()!;
        if (this.data.length > 0) {
            this.data[0] = last;
            this.sinkDown(0);
        }
        return top;
    }

    private bubbleUp(i: number): void {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.data[i].priority < this.data[parent].priority) {
                [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
                i = parent;
            } else break;
        }
    }

    private sinkDown(i: number): void {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if (left < n && this.data[left].priority < this.data[smallest].priority) smallest = left;
            if (right < n && this.data[right].priority < this.data[smallest].priority) smallest = right;
            if (smallest !== i) {
                [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
                i = smallest;
            } else break;
        }
    }
}

// ============================================================================
// A* Pathfinding
// ============================================================================

/** Default heuristic: Euclidean distance */
const euclideanHeuristic = (a: Vector, b: Vector): number => vecDistance(a, b);

/**
 * Find the shortest path between two nodes using A*.
 * 
 * @param graph The navigation graph
 * @param startId Starting node ID
 * @param goalId Goal node ID
 * @param options Optional pathfinding parameters
 * @returns A NavPath with waypoints, or EMPTY_PATH if no path exists
 */
export function findPath(graph: NavGraph, startId: number, goalId: number, options?: PathfindOptions): NavPath {
    const startNode = graph.nodeMap.get(startId);
    const goalNode = graph.nodeMap.get(goalId);
    if (!startNode || !goalNode) return EMPTY_PATH;
    if (startId === goalId) {
        return {
            waypoints: [startNode.position],
            totalLength: 0,
            nodeIds: [startId],
        };
    }

    const heuristic = options?.heuristic ?? euclideanHeuristic;
    const maxIterations = options?.maxIterations ?? Infinity;

    // g[nodeId] = cost from start to this node
    const gScore = new Map<number, number>();
    gScore.set(startId, 0);

    // Track which node we came from
    const cameFrom = new Map<number, number>();

    // Open set as a min-heap
    const open = new MinHeap();
    open.push(startId, heuristic(startNode.position, goalNode.position));

    // Closed set
    const closed = new Set<number>();

    let iterations = 0;

    while (open.size > 0 && iterations < maxIterations) {
        iterations++;

        const current = open.pop()!;
        const currentId = current.nodeId;

        if (currentId === goalId) {
            return reconstructPath(graph, cameFrom, goalId, gScore.get(goalId)!);
        }

        if (closed.has(currentId)) continue;
        closed.add(currentId);

        const currentNode = graph.nodeMap.get(currentId)!;
        const currentG = gScore.get(currentId)!;

        for (let i = 0; i < currentNode.neighbors.length; i++) {
            const neighborId = currentNode.neighbors[i];
            if (closed.has(neighborId)) continue;

            const tentativeG = currentG + currentNode.distances[i];
            const previousG = gScore.get(neighborId);

            if (previousG === undefined || tentativeG < previousG) {
                gScore.set(neighborId, tentativeG);
                cameFrom.set(neighborId, currentId);
                const neighborNode = graph.nodeMap.get(neighborId)!;
                const fScore = tentativeG + heuristic(neighborNode.position, goalNode.position);
                open.push(neighborId, fScore);
            }
        }
    }

    // No path found
    return EMPTY_PATH;
}

/**
 * Reconstruct the path from cameFrom map.
 */
function reconstructPath(graph: NavGraph, cameFrom: Map<number, number>, goalId: number, totalLength: number): NavPath {
    const nodeIds: number[] = [];
    let current = goalId;
    while (current !== undefined) {
        nodeIds.unshift(current);
        current = cameFrom.get(current)!;
        if (nodeIds.length > 1 && current === nodeIds[0]) break; // safety: prevent infinite loop
    }

    const waypoints = nodeIds.map(id => graph.nodeMap.get(id)!.position);

    return {
        waypoints,
        totalLength,
        nodeIds,
    };
}

/**
 * Find a path between two world positions (snaps to nearest nav nodes).
 * 
 * @param graph The navigation graph
 * @param from Start position in world space
 * @param to Goal position in world space
 * @param options Optional pathfinding parameters
 * @returns A NavPath with waypoints, or EMPTY_PATH if no path exists
 */
export function findPathBetweenPositions(
    graph: NavGraph,
    from: Vector,
    to: Vector,
    findNearest: (position: Vector, graph: NavGraph) => NavNode | null,
    options?: PathfindOptions
): NavPath {
    const startNode = findNearest(from, graph);
    const goalNode = findNearest(to, graph);
    if (!startNode || !goalNode) return EMPTY_PATH;

    return findPath(graph, startNode.id, goalNode.id, options);
}
