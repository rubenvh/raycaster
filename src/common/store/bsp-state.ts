import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableMapSet } from 'immer';
import { IBSPNode, NULL_NODE } from '../geometry/bsp/model';
import { IEdgeDiff } from '../geometry/bsp/dirty-edge-tracker';
import { IEntityKey } from '../geometry/entity';

// Enable Immer's MapSet plugin so we can use Set in Redux state via Immer drafts.
enableMapSet();

/**
 * BSP lifecycle status:
 * - 'none':       No BSP tree exists yet (initial state or no geometry loaded)
 * - 'fresh':      BSP tree is fully up-to-date with current geometry
 * - 'stale':      Geometry has changed since last BSP build; tree is usable but outdated
 * - 'rebuilding': An async rebuild is in progress
 */
export type BspStatus = 'none' | 'fresh' | 'stale' | 'rebuilding';

/** 
 * Mutable version of IEdgeDiff for use inside Redux state (Immer drafts need mutable Sets). 
 * The external IEdgeDiff uses ReadonlySet for safety; internally we use Set.
 */
export interface IMutableEdgeDiff {
    removedEdgeIds: Set<IEntityKey>;
    addedEdgeIds: Set<IEntityKey>;
    modifiedEdgeIds: Set<IEntityKey>;
}

const emptyMutableDiff = (): IMutableEdgeDiff => ({
    removedEdgeIds: new Set(),
    addedEdgeIds: new Set(),
    modifiedEdgeIds: new Set(),
});

/**
 * Bundles a BSP tree with its associated dirty edge state.
 * Passed as a single parameter through rendering and collision call chains
 * to reduce the number of parameters that must be threaded through intermediate functions.
 */
export interface IBspContext {
    readonly tree: IBSPNode | null;
    readonly dirtyEdges: IMutableEdgeDiff;
}

export interface IBspState {
    /** The current BSP tree (may be stale). null means no tree. */
    tree: IBSPNode | null;
    /** Current lifecycle status. */
    status: BspStatus;
    /** Accumulated dirty edges since last successful rebuild. */
    dirtyEdges: IMutableEdgeDiff;
    /** Total count of dirty edges (convenience for UI). */
    dirtyCount: number;
}

const initialState: IBspState = {
    tree: null,
    status: 'none',
    dirtyEdges: emptyMutableDiff(),
    dirtyCount: 0,
};

const bspSlice = createSlice({
    name: 'bsp',
    initialState,
    reducers: {
        /** Set the BSP tree (after a build completes or on load). */
        setBsp: (state, action: PayloadAction<IBSPNode | null>) => {
            state.tree = action.payload;
            state.status = action.payload ? 'fresh' : 'none';
            // Clear dirty tracking on fresh build
            state.dirtyEdges = emptyMutableDiff();
            state.dirtyCount = 0;
        },

        /** Mark edges as dirty (geometry changed). Tree becomes stale. */
        markDirty: (state, action: PayloadAction<IEdgeDiff>) => {
            const incoming = action.payload;
            if (incoming.removedEdgeIds.size === 0 
                && incoming.addedEdgeIds.size === 0 
                && incoming.modifiedEdgeIds.size === 0) {
                return; // no-op for empty diffs
            }

            // Merge incoming diff with existing dirty state.
            // We use plain Sets in Redux state (RTK allows mutation via Immer).
            const removed = new Set(state.dirtyEdges.removedEdgeIds);
            const added = new Set(state.dirtyEdges.addedEdgeIds);
            const modified = new Set(state.dirtyEdges.modifiedEdgeIds);

            // Apply removals
            for (const id of incoming.removedEdgeIds) {
                if (added.delete(id)) {
                    modified.delete(id);
                } else {
                    modified.delete(id);
                    removed.add(id);
                }
            }
            // Apply additions
            for (const id of incoming.addedEdgeIds) {
                if (removed.delete(id)) {
                    modified.add(id);
                } else {
                    added.add(id);
                }
            }
            // Apply modifications
            for (const id of incoming.modifiedEdgeIds) {
                if (!added.has(id) && !removed.has(id)) {
                    modified.add(id);
                }
            }

            state.dirtyEdges = { removedEdgeIds: removed, addedEdgeIds: added, modifiedEdgeIds: modified };
            state.dirtyCount = removed.size + added.size + modified.size;

            if (state.status === 'fresh') {
                state.status = 'stale';
            }
        },

        /** Signal that a rebuild has started. */
        setRebuilding: (state) => {
            state.status = 'rebuilding';
        },

        /** Clear the BSP tree entirely (e.g. geometry was replaced wholesale). */
        clearBsp: (state) => {
            state.tree = null;
            state.status = 'none';
            state.dirtyEdges = emptyMutableDiff();
            state.dirtyCount = 0;
        },
    },
});

export default bspSlice.reducer;
export const { setBsp, markDirty, setRebuilding, clearBsp } = bspSlice.actions;
