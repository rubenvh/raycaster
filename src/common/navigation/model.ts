/**
 * Navigation system interfaces.
 * 
 * Designed to be reusable by any entity that needs pathfinding:
 * dance camera, NPCs, enemies, etc. The navigation graph is built
 * from the geometry's negative space (walkable areas between walls).
 */
import { Vector } from '../math/vector';

// ============================================================================
// Navigation Graph
// ============================================================================

/** A node in the navigation graph — represents a walkable position */
export type NavNode = {
    /** Unique identifier for this node */
    id: number;
    /** Position in world space */
    position: Vector;
    /** IDs of connected NavNodes */
    neighbors: number[];
    /** Distances to each neighbor (parallel array with neighbors) */
    distances: number[];
};

/** A navigation graph built from geometry */
export type NavGraph = {
    /** All nodes in the graph */
    nodes: NavNode[];
    /** Map from node ID to NavNode for O(1) lookup */
    nodeMap: Map<number, NavNode>;
    /** Grid cell size used to build the graph */
    cellSize: number;
    /** World bounds: [width, height] */
    bounds: Vector;
};

// ============================================================================
// Pathfinding
// ============================================================================

/** A path through the navigation graph */
export type NavPath = {
    /** Ordered list of world-space positions to visit */
    waypoints: Vector[];
    /** Total path length (sum of segment distances) */
    totalLength: number;
    /** Node IDs along the path (parallel with waypoints) */
    nodeIds: number[];
};

export const EMPTY_PATH: NavPath = {
    waypoints: [],
    totalLength: 0,
    nodeIds: [],
};

/** Options for pathfinding */
export type PathfindOptions = {
    /** Maximum number of nodes to explore before giving up (default: Infinity) */
    maxIterations?: number;
    /** Custom heuristic function (default: Euclidean distance) */
    heuristic?: (a: Vector, b: Vector) => number;
};

// ============================================================================
// Points of Interest (for geometry analyzer)
// ============================================================================

/** Classification of an interesting location */
export enum PointOfInterestType {
    /** Junction where multiple corridors meet */
    Junction = 'junction',
    /** Open area (room) */
    OpenSpace = 'open_space',
    /** Dead end / alcove */
    DeadEnd = 'dead_end',
    /** Narrow corridor */
    Corridor = 'corridor',
    /** Visually complex area (many nearby edges) */
    VisuallyComplex = 'visually_complex',
}

/** An interesting location identified by geometry analysis */
export type PointOfInterest = {
    /** World position */
    position: Vector;
    /** Classification */
    type: PointOfInterestType;
    /** Interest score (higher = more interesting to visit) */
    score: number;
    /** Nearest nav-node ID (for pathfinding) */
    nearestNodeId: number;
};

/** Result of geometry analysis */
export type GeometryAnalysis = {
    /** All identified points of interest, sorted by score descending */
    pointsOfInterest: PointOfInterest[];
    /** Average openness of the map (0-1) */
    averageOpenness: number;
    /** Longest clear line-of-sight distance found */
    maxLineOfSight: number;
};
