/**
 * Geometry analyzer: identifies interesting locations for dance camera navigation.
 * 
 * Analyzes the navigation graph and geometry to find:
 * - Junctions (nodes with many connections — corridor intersections)
 * - Open spaces (nodes far from walls)
 * - Dead ends (nodes with few connections)
 * - Visually complex areas (many edges visible)
 * - Corridors (long narrow paths)
 * 
 * These points of interest form the waypoint tour for the dance camera.
 */
import { Vector, distance as vecDistance, subtract, normalize, scale, add } from '../math/vector';
import { IGeometry } from '../geometry/geometry';
import { IEdge } from '../geometry/edge';
import { distanceTo } from '../math/lineSegment';
import { NavGraph, NavNode } from './model';
import { PointOfInterest, PointOfInterestType, GeometryAnalysis } from './model';
import { collectSolidEdges, findNearestNode } from './nav-graph';

// ============================================================================
// Analysis Configuration
// ============================================================================

/** Radius to search for nearby edges when scoring visual complexity */
const VISUAL_COMPLEXITY_RADIUS = 120;

/** Minimum number of neighbors to qualify as a junction */
const JUNCTION_MIN_NEIGHBORS = 5;

/** Maximum neighbors to classify as a dead end */
const DEAD_END_MAX_NEIGHBORS = 2;

/** Minimum interest score to include a point of interest */
const MIN_INTEREST_SCORE = 0.2;

/** Maximum number of points of interest to return */
const MAX_POINTS_OF_INTEREST = 30;

// ============================================================================
// Openness calculation
// ============================================================================

/**
 * Calculates how "open" a position is by measuring the average distance
 * to nearby solid edges. Higher = more open space around the point.
 */
function calculateOpenness(position: Vector, solidEdges: IEdge[], maxRadius: number = 200): number {
    let totalDist = 0;
    let count = 0;

    for (const edge of solidEdges) {
        const dist = distanceTo(position, edge.segment);
        if (dist < maxRadius) {
            totalDist += dist;
            count++;
        }
    }

    if (count === 0) return 1; // No walls nearby = maximally open
    const avgDist = totalDist / count;
    // Normalize to 0-1 range
    return Math.min(1, avgDist / maxRadius);
}

/**
 * Counts the number of solid edges visible (within radius) from a position.
 * More edges = more visually complex and interesting to look at.
 */
function calculateVisualComplexity(position: Vector, solidEdges: IEdge[], radius: number = VISUAL_COMPLEXITY_RADIUS): number {
    let count = 0;
    for (const edge of solidEdges) {
        if (edge.material == null) continue; // Skip invisible edges
        const dist = distanceTo(position, edge.segment);
        if (dist < radius) {
            count++;
        }
    }
    return count;
}

// ============================================================================
// Point of Interest Classification
// ============================================================================

/**
 * Classifies a nav-node into a PointOfInterestType based on its properties.
 */
function classifyNode(node: NavNode, openness: number, neighborCount: number): PointOfInterestType {
    if (neighborCount >= JUNCTION_MIN_NEIGHBORS && openness > 0.3) {
        return PointOfInterestType.Junction;
    }
    if (openness > 0.5) {
        return PointOfInterestType.OpenSpace;
    }
    if (neighborCount <= DEAD_END_MAX_NEIGHBORS) {
        return PointOfInterestType.DeadEnd;
    }
    return PointOfInterestType.Corridor;
}

/**
 * Scores a point of interest. Higher scores = more interesting to visit.
 * 
 * Scoring factors:
 * - Visual complexity (many visible edges = interesting to look at while dancing)
 * - Openness (rooms > corridors for dancing freedom)
 * - Connectivity (junctions are natural crossroads to pass through)
 * - Dead ends get a bonus (good for dramatic pauses/turnarounds)
 */
function scorePointOfInterest(
    type: PointOfInterestType,
    openness: number,
    visualComplexity: number,
    neighborCount: number,
    maxComplexity: number,
): number {
    const normalizedComplexity = maxComplexity > 0 ? visualComplexity / maxComplexity : 0;

    let score = 0;

    switch (type) {
        case PointOfInterestType.Junction:
            score = 0.4 + normalizedComplexity * 0.3 + openness * 0.3;
            break;
        case PointOfInterestType.OpenSpace:
            score = 0.5 + normalizedComplexity * 0.2 + openness * 0.3;
            break;
        case PointOfInterestType.DeadEnd:
            score = 0.3 + normalizedComplexity * 0.4 + 0.3; // Bonus for dead ends
            break;
        case PointOfInterestType.Corridor:
            score = 0.2 + normalizedComplexity * 0.4 + openness * 0.2;
            break;
        case PointOfInterestType.VisuallyComplex:
            score = 0.3 + normalizedComplexity * 0.5 + openness * 0.2;
            break;
    }

    return Math.min(1, score);
}

// ============================================================================
// Main Analysis
// ============================================================================

/**
 * Analyze the geometry and navigation graph to find interesting locations.
 * 
 * @param geometry The game geometry
 * @param graph The navigation graph built from the geometry
 * @returns GeometryAnalysis with sorted points of interest
 */
export function analyzeGeometry(geometry: IGeometry, graph: NavGraph): GeometryAnalysis {
    if (graph.nodes.length === 0) {
        return {
            pointsOfInterest: [],
            averageOpenness: 0,
            maxLineOfSight: 0,
        };
    }

    const solidEdges = collectSolidEdges(geometry);

    // Phase 1: Calculate metrics for all nodes
    type NodeMetrics = {
        node: NavNode;
        openness: number;
        visualComplexity: number;
    };

    const metrics: NodeMetrics[] = [];
    let maxComplexity = 0;
    let totalOpenness = 0;

    // Sample a subset of nodes for performance (every Nth node)
    const stride = Math.max(1, Math.floor(graph.nodes.length / 200));

    for (let i = 0; i < graph.nodes.length; i += stride) {
        const node = graph.nodes[i];
        const openness = calculateOpenness(node.position, solidEdges);
        const complexity = calculateVisualComplexity(node.position, solidEdges);

        totalOpenness += openness;
        if (complexity > maxComplexity) maxComplexity = complexity;

        metrics.push({ node, openness, visualComplexity: complexity });
    }

    const averageOpenness = totalOpenness / metrics.length;

    // Phase 2: Classify and score each sampled node
    const pois: PointOfInterest[] = [];

    for (const m of metrics) {
        const neighborCount = m.node.neighbors.length;
        const type = classifyNode(m.node, m.openness, neighborCount);
        const score = scorePointOfInterest(type, m.openness, m.visualComplexity, neighborCount, maxComplexity);

        if (score >= MIN_INTEREST_SCORE) {
            pois.push({
                position: m.node.position,
                type,
                score,
                nearestNodeId: m.node.id,
            });
        }
    }

    // Phase 3: Filter out POIs that are too close together (keep highest score)
    const MIN_POI_DISTANCE = graph.cellSize * 3;
    const filtered = filterClosePoints(pois, MIN_POI_DISTANCE);

    // Sort by score descending and cap at max
    filtered.sort((a, b) => b.score - a.score);
    const finalPois = filtered.slice(0, MAX_POINTS_OF_INTEREST);

    // Estimate max line-of-sight from the most open node
    const maxLineOfSight = metrics.reduce((max, m) => Math.max(max, m.openness * 500), 0);

    return {
        pointsOfInterest: finalPois,
        averageOpenness,
        maxLineOfSight,
    };
}

/**
 * Filters out points that are too close together, keeping the one with higher score.
 */
function filterClosePoints(pois: PointOfInterest[], minDistance: number): PointOfInterest[] {
    // Sort by score descending so we keep higher-scoring points
    const sorted = [...pois].sort((a, b) => b.score - a.score);
    const result: PointOfInterest[] = [];

    for (const poi of sorted) {
        const tooClose = result.some(existing =>
            vecDistance(existing.position, poi.position) < minDistance
        );
        if (!tooClose) {
            result.push(poi);
        }
    }

    return result;
}

/**
 * Build a tour through the points of interest.
 * Uses a simple nearest-neighbor heuristic to create a loop.
 * 
 * @param pois Points of interest to visit
 * @returns Ordered array of POI positions forming a tour
 */
export function buildTour(pois: PointOfInterest[]): Vector[] {
    if (pois.length === 0) return [];
    if (pois.length === 1) return [pois[0].position];

    const remaining = [...pois];
    const tour: Vector[] = [];

    // Start from the highest-scored POI
    let current = remaining.shift()!;
    tour.push(current.position);

    while (remaining.length > 0) {
        // Find nearest unvisited POI
        let nearestIdx = 0;
        let nearestDist = vecDistance(current.position, remaining[0].position);

        for (let i = 1; i < remaining.length; i++) {
            const dist = vecDistance(current.position, remaining[i].position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIdx = i;
            }
        }

        current = remaining.splice(nearestIdx, 1)[0];
        tour.push(current.position);
    }

    return tour;
}
