import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableMapSet, immerable } from 'immer';
import { IBSPNode, isLeafNode, isSplitNode, NULL_NODE } from '../geometry/bsp/model';
import { IEdgeDiff } from '../geometry/bsp/dirty-edge-tracker';
import { IEntityKey } from '../geometry/entity';
import { IPolygon } from '../geometry/polygon';
import { IEdge } from '../geometry/edge';

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
 * Wrapper class that prevents Immer from deep-freezing the BSP tree.
 * 
 * BSP trees stored in Redux state would normally be frozen by Immer, making
 * in-place material patching impossible. By marking this class with
 * `immerable = false`, Immer treats instances as opaque values — it won't
 * proxy, freeze, or deeply process them.
 * 
 * This enables Phase 8's in-place material mutation: when edge materials change,
 * the middleware patches BSP edge objects directly without a full tree rebuild.
 */
export class BspTreeHolder {
    static [immerable] = false;
    constructor(public readonly node: IBSPNode) {}
}

/** Extract the raw BSP node from a holder, or return null. */
export function getBspTree(holder: BspTreeHolder | null): IBSPNode | null {
    return holder?.node ?? null;
}

/**
 * Ensures BSP tree edges are mutable by thawing any frozen objects.
 * 
 * In tests, polygons passed to buildBspTree come from the Redux store and are
 * frozen by Immer. The BSP tree then holds references to those same frozen edge
 * objects, preventing in-place material patching. In production, the web worker's
 * postMessage/structured-clone already produces unfrozen copies, so this is a
 * no-op for unfrozen trees.
 * 
 * Only thaws edges (and their containing polygon/edges arrays) since those are
 * the objects mutated by patchBspEdgeMaterials.
 */
function thawBspTree(node: IBSPNode): IBSPNode {
    if (node.type === 'null') return node;

    if (isLeafNode(node)) {
        const thawed = thawPolygons(node.polygons);
        return thawed === node.polygons ? node : { ...node, polygons: thawed };
    }

    if (isSplitNode(node)) {
        const front = thawBspTree(node.front);
        const back = thawBspTree(node.back);
        const coplanar = thawPolygons(node.coplanar);
        if (front === node.front && back === node.back && coplanar === node.coplanar) {
            return node;
        }
        return { ...node, front, back, coplanar };
    }

    return node;
}

/** Thaw polygon edges if any are frozen. Returns same array if nothing needed thawing. */
function thawPolygons(polygons: IPolygon[]): IPolygon[] {
    let changed = false;
    const result: IPolygon[] = new Array(polygons.length);
    for (let i = 0; i < polygons.length; i++) {
        const poly = polygons[i];
        const edges = thawEdges(poly.edges);
        if (edges !== poly.edges) {
            result[i] = { ...poly, edges };
            changed = true;
        } else {
            result[i] = poly;
        }
    }
    return changed ? result : polygons;
}

/** Thaw frozen edges by creating shallow copies. Returns same array if nothing frozen. */
function thawEdges(edges: IEdge[]): IEdge[] {
    let changed = false;
    const result: IEdge[] = new Array(edges.length);
    for (let i = 0; i < edges.length; i++) {
        if (Object.isFrozen(edges[i])) {
            result[i] = { ...edges[i] };
            changed = true;
        } else {
            result[i] = edges[i];
        }
    }
    return changed ? result : edges;
}

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
    /** The current BSP tree holder (may be stale). null means no tree. */
    treeHolder: BspTreeHolder | null;
    /** Current lifecycle status. */
    status: BspStatus;
    /** Accumulated dirty edges since last successful rebuild. */
    dirtyEdges: IMutableEdgeDiff;
    /** Total count of dirty edges (convenience for UI). */
    dirtyCount: number;
}

const initialState: IBspState = {
    treeHolder: null,
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
            const tree = action.payload ? thawBspTree(action.payload) : null;
            state.treeHolder = tree ? new BspTreeHolder(tree) : null;
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
    },
});

export default bspSlice.reducer;
export const { setBsp, markDirty, setRebuilding } = bspSlice.actions;
