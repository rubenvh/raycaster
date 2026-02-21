import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { RootState } from './index';
import { IGeometry } from '../geometry/geometry';
import { IEntityKey } from '../geometry/entity';
import { IEdgeDiff, EMPTY_DIFF } from '../geometry/bsp/dirty-edge-tracker';
import { markDirty, clearBsp } from './bsp-state';

/**
 * Collects all edge IDs from a geometry into a Set.
 */
function collectEdgeIds(geometry: IGeometry): Set<IEntityKey> {
    const ids = new Set<IEntityKey>();
    for (const polygon of geometry.polygons) {
        for (const edge of polygon.edges) {
            if (edge.id != null) {
                ids.add(edge.id);
            }
        }
    }
    return ids;
}

/**
 * Computes an edge diff between old and new geometry.
 * 
 * - removed: IDs present in old but not in new
 * - added: IDs present in new but not in old
 * - modified: IDs present in both (edge was cloned/transformed — same ID, possibly new geometry)
 * 
 * Note: We treat ALL surviving IDs as "modified" because we can't cheaply
 * detect whether the edge geometry actually changed (vertices are mutable).
 * This is conservative but correct — the BSP dirty tracker handles no-op
 * modifications gracefully.
 */
function computeEdgeDiff(oldGeometry: IGeometry, newGeometry: IGeometry): IEdgeDiff {
    // Quick identity check — if the geometry object is the same reference, 
    // no mutation occurred (e.g., undo to same state, or no-op operations).
    if (oldGeometry === newGeometry) return EMPTY_DIFF;

    const oldIds = collectEdgeIds(oldGeometry);
    const newIds = collectEdgeIds(newGeometry);

    const removedEdgeIds = new Set<IEntityKey>();
    const addedEdgeIds = new Set<IEntityKey>();
    const modifiedEdgeIds = new Set<IEntityKey>();

    // IDs in old but not new → removed
    for (const id of oldIds) {
        if (!newIds.has(id)) {
            removedEdgeIds.add(id);
        }
    }

    // IDs in new but not old → added
    // IDs in both → modified (conservative: assume geometry changed)
    for (const id of newIds) {
        if (!oldIds.has(id)) {
            addedEdgeIds.add(id);
        } else {
            modifiedEdgeIds.add(id);
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
