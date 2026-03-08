/**
 * Navigation graph builder.
 * 
 * Builds a walkable navigation graph from the geometry by:
 * 1. Sampling a grid of candidate positions across the map bounds
 * 2. Testing each position for walkability (not inside any solid polygon)
 * 3. Connecting adjacent walkable positions with edges (4-connected + diagonals)
 * 4. Validating connections with line-of-sight checks against solid edges
 * 
 * The resulting NavGraph is reusable by any entity needing pathfinding.
 */
import { Vector, distance as vecDistance, add, scale, subtract, cross } from '../math/vector';
import { IGeometry } from '../geometry/geometry';
import { IEdge } from '../geometry/edge';
import { IPolygon } from '../geometry/polygon';
import { ILineSegment, distanceTo } from '../math/lineSegment';
import { NavGraph, NavNode } from './model';

// ============================================================================
// Configuration
// ============================================================================

/** Default grid cell size for nav-graph sampling. ~30 units works well for
 *  map coordinates in the 0-1200 range with walls ~60-80 units long. */
const DEFAULT_CELL_SIZE = 30;

/** Minimum distance from a wall for a position to be considered walkable.
 *  Should be >= the camera's collision safe distance (~2.25). */
const WALL_CLEARANCE = 5;

// ============================================================================
// Point-in-polygon test (winding number algorithm)
// ============================================================================

/**
 * Tests whether a point is inside a polygon using the winding number algorithm.
 * Works for both convex and non-convex polygons.
 * @returns true if the point is inside the polygon
 */
export function isPointInPolygon(point: Vector, polygon: IPolygon): boolean {
    let winding = 0;
    const n = polygon.vertices.length;
    for (let i = 0; i < n; i++) {
        const v1 = polygon.vertices[i].vector;
        const v2 = polygon.vertices[(i + 1) % n].vector;

        if (v1[1] <= point[1]) {
            if (v2[1] > point[1]) {
                // Upward crossing
                if (isLeft(v1, v2, point) > 0) {
                    winding++;
                }
            }
        } else {
            if (v2[1] <= point[1]) {
                // Downward crossing
                if (isLeft(v1, v2, point) < 0) {
                    winding--;
                }
            }
        }
    }
    return winding !== 0;
}

/** Helper: tests if point P is to the left of the line from V1 to V2.
 *  Returns > 0 if left, < 0 if right, 0 if on the line. */
function isLeft(v1: Vector, v2: Vector, p: Vector): number {
    return (v2[0] - v1[0]) * (p[1] - v1[1]) - (p[0] - v1[0]) * (v2[1] - v1[1]);
}

// ============================================================================
// Segment-segment intersection
// ============================================================================

/**
 * Tests whether two line segments intersect.
 * Returns true if segments [a1, a2] and [b1, b2] cross each other.
 */
export function segmentsIntersect(a1: Vector, a2: Vector, b1: Vector, b2: Vector): boolean {
    const d1x = a2[0] - a1[0];
    const d1y = a2[1] - a1[1];
    const d2x = b2[0] - b1[0];
    const d2y = b2[1] - b1[1];

    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-10) return false; // Parallel or coincident

    const dx = b1[0] - a1[0];
    const dy = b1[1] - a1[1];

    const t = (dx * d2y - dy * d2x) / denom;
    const u = (dx * d1y - dy * d1x) / denom;

    // Both parameters must be in (0, 1) — we use a small epsilon to avoid
    // counting intersections exactly at endpoints (e.g. touching a wall corner)
    const EPS = 1e-6;
    return t > EPS && t < (1 - EPS) && u > EPS && u < (1 - EPS);
}

// ============================================================================
// Walkability testing
// ============================================================================

/** Collects all solid (non-immaterial) edges from geometry */
export function collectSolidEdges(geometry: IGeometry): IEdge[] {
    const edges: IEdge[] = [];
    for (const polygon of geometry.polygons) {
        for (const edge of polygon.edges) {
            if (!edge.immaterial) {
                edges.push(edge);
            }
        }
    }
    return edges;
}

/**
 * Tests whether a position is walkable:
 * - Must not be too close to any solid edge
 * - Must have clearance from walls
 */
export function isWalkable(point: Vector, solidEdges: IEdge[], clearance: number = WALL_CLEARANCE): boolean {
    for (const edge of solidEdges) {
        const dist = distanceTo(point, edge.segment);
        if (dist < clearance) {
            return false;
        }
    }
    return true;
}

/**
 * Tests whether a straight line between two points is clear of solid walls.
 * Used to validate nav-graph edges.
 * 
 * Performs two checks:
 * 1. Segment intersection — the path must not cross any wall.
 * 2. Clearance sampling — the path must maintain minimum distance from all
 *    walls along its entire length, not just at endpoints. This prevents
 *    paths that "graze" wall corners or pass too close to walls for the
 *    camera's collision envelope.
 */
export function hasLineOfSight(from: Vector, to: Vector, solidEdges: IEdge[], clearance: number = WALL_CLEARANCE): boolean {
    // Fast rejection: does the path cross any wall?
    for (const edge of solidEdges) {
        const s = edge.segment;
        if (segmentsIntersect(from, to, s[0], s[1])) {
            return false;
        }
    }

    // Clearance check: sample points along the path and verify each maintains
    // minimum distance from all walls. Sampling interval is half the clearance
    // to avoid missing narrow gaps between samples.
    const pathLength = vecDistance(from, to);
    if (pathLength < 1e-6) return true;

    const sampleInterval = clearance * 0.5;
    const steps = Math.max(1, Math.ceil(pathLength / sampleInterval));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const sample: Vector = [
            from[0] + t * (to[0] - from[0]),
            from[1] + t * (to[1] - from[1]),
        ];
        if (!isWalkable(sample, solidEdges, clearance)) {
            return false;
        }
    }

    return true;
}

// ============================================================================
// Nav-graph builder
// ============================================================================

/**
 * Builds a navigation graph from the game geometry.
 * 
 * Algorithm:
 * 1. Sample a regular grid across the map bounds
 * 2. Mark each grid cell as walkable/blocked based on wall proximity
 * 3. Connect adjacent walkable cells (8-connected: cardinal + diagonal)
 * 4. Validate each connection with line-of-sight check
 * 
 * @param geometry The game geometry to build the nav-graph from
 * @param cellSize Grid cell size (default: 30 units)
 * @returns A NavGraph ready for pathfinding
 */
export function buildNavGraph(geometry: IGeometry, cellSize: number = DEFAULT_CELL_SIZE): NavGraph {
    const bounds = geometry.bounds;
    if (bounds[0] <= 0 || bounds[1] <= 0) {
        return { nodes: [], nodeMap: new Map(), cellSize, bounds };
    }

    const solidEdges = collectSolidEdges(geometry);

    // Grid dimensions
    const cols = Math.ceil(bounds[0] / cellSize);
    const rows = Math.ceil(bounds[1] / cellSize);

    // Phase 1: Sample grid and test walkability
    // grid[row][col] = node ID or -1 if blocked
    const grid: number[][] = [];
    const nodes: NavNode[] = [];
    let nextId = 0;

    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            const position: Vector = [
                (c + 0.5) * cellSize,
                (r + 0.5) * cellSize,
            ];

            if (isWalkable(position, solidEdges)) {
                const id = nextId++;
                grid[r][c] = id;
                nodes.push({
                    id,
                    position,
                    neighbors: [],
                    distances: [],
                });
            } else {
                grid[r][c] = -1;
            }
        }
    }

    // Phase 2: Connect adjacent walkable cells
    // 8-connected neighborhood: [dr, dc] pairs
    const offsets: [number, number][] = [
        [-1, 0], [1, 0], [0, -1], [0, 1],     // Cardinal
        [-1, -1], [-1, 1], [1, -1], [1, 1],    // Diagonal
    ];

    const nodeMap = new Map<number, NavNode>();
    for (const node of nodes) {
        nodeMap.set(node.id, node);
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const nodeId = grid[r][c];
            if (nodeId === -1) continue;

            const node = nodeMap.get(nodeId)!;

            for (const [dr, dc] of offsets) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

                const neighborId = grid[nr][nc];
                if (neighborId === -1) continue;

                // Diagonal corner-cutting prevention: for diagonal moves,
                // both adjacent cardinal cells must also be walkable.
                // Without this, a diagonal connection can squeeze through
                // the gap between two walls meeting at a grid corner.
                const isDiagonal = dr !== 0 && dc !== 0;
                if (isDiagonal) {
                    const cardinalA = grid[r + dr]?.[c] ?? -1;
                    const cardinalB = grid[r]?.[c + dc] ?? -1;
                    if (cardinalA === -1 || cardinalB === -1) continue;
                }

                const neighbor = nodeMap.get(neighborId)!;

                // Line-of-sight check (with clearance) to ensure no wall between cells
                if (hasLineOfSight(node.position, neighbor.position, solidEdges)) {
                    node.neighbors.push(neighborId);
                    node.distances.push(vecDistance(node.position, neighbor.position));
                }
            }
        }
    }

    return { nodes, nodeMap, cellSize, bounds };
}

/**
 * Finds the nearest walkable nav-node to a given world position.
 * Returns null if the graph is empty.
 */
export function findNearestNode(position: Vector, graph: NavGraph): NavNode | null {
    if (graph.nodes.length === 0) return null;

    let bestNode: NavNode = graph.nodes[0];
    let bestDist = vecDistance(position, bestNode.position);

    for (let i = 1; i < graph.nodes.length; i++) {
        const dist = vecDistance(position, graph.nodes[i].position);
        if (dist < bestDist) {
            bestDist = dist;
            bestNode = graph.nodes[i];
        }
    }

    return bestNode;
}
