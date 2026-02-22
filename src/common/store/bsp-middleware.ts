import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { RootState } from './index';
import { IGeometry } from '../geometry/geometry';
import { IEdge } from '../geometry/edge';
import { IPolygon } from '../geometry/polygon';
import { IEntityKey } from '../geometry/entity';
import { IEdgeDiff, EMPTY_DIFF } from '../geometry/bsp/dirty-edge-tracker';
import { markDirty, clearBsp } from './bsp-state';

/**
 * Returns true if two edges have identical vertex positions.
 * Used to distinguish edges that were cloned but not moved from edges
 * whose vertices actually changed (e.g., a vertex drag).
 */
function verticesMatch(oldEdge: IEdge, newEdge: IEdge): boolean {
    return oldEdge.start.vector[0] === newEdge.start.vector[0]
        && oldEdge.start.vector[1] === newEdge.start.vector[1]
        && oldEdge.end.vector[0] === newEdge.end.vector[0]
        && oldEdge.end.vector[1] === newEdge.end.vector[1];
}

/**
 * Computes an edge diff between old and new geometry using a two-tier approach:
 * 
 * **Tier 1 — Polygon reference equality:**
 * Polygons that are the same JS reference (===) in both old and new geometry
 * are skipped entirely. This works because adaptPolygons/forkPolygons/addPolygon
 * preserve unchanged polygon objects by reference.
 * 
 * **Tier 2 — Edge vertex comparison (within changed polygons only):**
 * For polygons that changed (different reference or different ID set), compare
 * each edge's start/end vertex positions. Only edges whose vertices actually
 * moved are marked as "modified". This means moving 1 vertex in a 20-edge
 * polygon marks only 2 edges dirty (the two adjacent ones), not all 20.
 * 
 * Material-only changes are intentionally NOT tracked as "modified" because
 * the BSP is a spatial index — material changes don't invalidate an edge's
 * position in the tree. The renderer will find the edge via normal BSP walk
 * and render its current material regardless.
 */
function computeEdgeDiff(oldGeometry: IGeometry, newGeometry: IGeometry): IEdgeDiff {
    // Quick identity check — if the geometry object is the same reference, 
    // no mutation occurred (e.g., undo to same state, or no-op operations).
    if (oldGeometry === newGeometry) return EMPTY_DIFF;

    // Tier 1: Build polygon lookup for old geometry
    const oldPolygonMap = new Map<IEntityKey, IPolygon>();
    for (const p of oldGeometry.polygons) {
        if (p.id != null) oldPolygonMap.set(p.id, p);
    }

    const removedEdgeIds = new Set<IEntityKey>();
    const addedEdgeIds = new Set<IEntityKey>();
    const modifiedEdgeIds = new Set<IEntityKey>();
    const seenOldPolygonIds = new Set<IEntityKey>();

    for (const newPoly of newGeometry.polygons) {
        const oldPoly = newPoly.id != null ? oldPolygonMap.get(newPoly.id) : undefined;

        if (oldPoly === newPoly) {
            // Tier 1: Same reference — polygon is completely unchanged, skip all edges
            if (newPoly.id != null) seenOldPolygonIds.add(newPoly.id);
            continue;
        }

        if (oldPoly != null) {
            // Polygon was mutated (same ID, different reference)
            // Tier 2: Compare individual edge vertices
            seenOldPolygonIds.add(newPoly.id!);

            const oldEdgeMap = new Map<IEntityKey, IEdge>();
            for (const e of oldPoly.edges) {
                if (e.id != null) oldEdgeMap.set(e.id, e);
            }

            for (const e of newPoly.edges) {
                if (e.id != null) {
                    const oldEdge = oldEdgeMap.get(e.id);
                    if (oldEdge != null) {
                        oldEdgeMap.delete(e.id);
                        // Only mark modified if vertices actually moved
                        if (!verticesMatch(oldEdge, e)) {
                            modifiedEdgeIds.add(e.id);
                        }
                    } else {
                        addedEdgeIds.add(e.id);
                    }
                }
            }

            // Old edges not found in new polygon → removed
            for (const id of oldEdgeMap.keys()) {
                removedEdgeIds.add(id);
            }
        } else {
            // Polygon not in old geometry → all its edges are new
            for (const e of newPoly.edges) {
                if (e.id != null) addedEdgeIds.add(e.id);
            }
        }
    }

    // Old polygons not seen in new geometry → all their edges removed
    for (const [oldId, oldPoly] of oldPolygonMap) {
        if (!seenOldPolygonIds.has(oldId)) {
            for (const e of oldPoly.edges) {
                if (e.id != null) removedEdgeIds.add(e.id);
            }
        }
    }

    if (removedEdgeIds.size === 0 && addedEdgeIds.size === 0 && modifiedEdgeIds.size === 0) {
        return EMPTY_DIFF;
    }

    return { removedEdgeIds, addedEdgeIds, modifiedEdgeIds };
}

/**
 * Walls actions that should trigger BSP dirty tracking.
 * We match any action starting with 'walls/' except:
 * - 'walls/loadWalls' — handled separately (full geometry replacement → clearBsp)
 */
const WALLS_PREFIX = 'walls/';
const LOAD_WALLS_TYPE = 'walls/loadWalls';

/**
 * Walls actions that are geometry mutations (not undo/redo/load).
 * Undo/redo also change geometry, so they also need diff computation.
 */
function isWallsMutationAction(action: { type: string }): boolean {
    return action.type.startsWith(WALLS_PREFIX) && action.type !== LOAD_WALLS_TYPE;
}

/**
 * Creates the BSP listener middleware.
 * 
 * Listens for all walls slice mutations and computes edge diffs between
 * old and new geometry. Dispatches markDirty to bspState when edges change.
 * 
 * For loadWalls (complete geometry replacement), dispatches clearBsp
 * to signal a full BSP rebuild is needed.
 */
export const bspListenerMiddleware = createListenerMiddleware();

// Handle loadWalls: complete geometry replacement
bspListenerMiddleware.startListening({
    predicate: (action) => action.type === LOAD_WALLS_TYPE,
    effect: async (_action, listenerApi) => {
        listenerApi.dispatch(clearBsp());
    },
});

// Handle all other walls mutations: compute edge diff
bspListenerMiddleware.startListening({
    predicate: isWallsMutationAction,
    effect: async (_action, listenerApi) => {
        const currentState = listenerApi.getState() as RootState;
        const originalState = listenerApi.getOriginalState() as RootState;

        const oldGeometry = originalState.walls.geometry;
        const newGeometry = currentState.walls.geometry;

        const diff = computeEdgeDiff(oldGeometry, newGeometry);

        // Only dispatch if there's an actual diff
        if (diff !== EMPTY_DIFF) {
            listenerApi.dispatch(markDirty(diff));
        }
    },
});
