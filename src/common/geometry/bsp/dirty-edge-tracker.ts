import { IEntityKey } from '../entity';

/**
 * Tracks which edges have been modified since the last BSP rebuild.
 * 
 * Three categories of dirt:
 * - **removed**: edges that were deleted from the geometry
 * - **added**: edges that are new (have new IDs)
 * - **modified**: edges whose ID stayed the same but whose geometry changed
 *   (e.g. a vertex was dragged)
 * 
 * This is a pure data structure with no Redux or side-effect dependencies.
 */
export interface IEdgeDiff {
    readonly removedEdgeIds: ReadonlySet<IEntityKey>;
    readonly addedEdgeIds: ReadonlySet<IEntityKey>;
    readonly modifiedEdgeIds: ReadonlySet<IEntityKey>;
}

export const EMPTY_DIFF: IEdgeDiff = Object.freeze({
    removedEdgeIds: new Set<IEntityKey>(),
    addedEdgeIds: new Set<IEntityKey>(),
    modifiedEdgeIds: new Set<IEntityKey>(),
});

export class DirtyEdgeTracker {
    private _removed = new Set<IEntityKey>();
    private _added = new Set<IEntityKey>();
    private _modified = new Set<IEntityKey>();

    /** True when there are no pending dirty edges of any kind. */
    get isClean(): boolean {
        return this._removed.size === 0
            && this._added.size === 0
            && this._modified.size === 0;
    }

    /** Total number of dirty edges across all categories. */
    get dirtyCount(): number {
        return this._removed.size + this._added.size + this._modified.size;
    }

    /** Snapshot of the current dirty state. */
    get diff(): IEdgeDiff {
        return {
            removedEdgeIds: new Set(this._removed),
            addedEdgeIds: new Set(this._added),
            modifiedEdgeIds: new Set(this._modified),
        };
    }

    /** Mark an edge as removed. Clears it from added/modified if present. */
    markRemoved(id: IEntityKey): void {
        // If it was added in this same dirty window, just forget it entirely
        // (it was born and died between rebuilds — net effect is nothing).
        if (this._added.delete(id)) {
            // Don't add to _removed — the BSP never knew about it.
            this._modified.delete(id);
            return;
        }
        this._modified.delete(id);
        this._removed.add(id);
    }

    /** Mark an edge as newly added. */
    markAdded(id: IEntityKey): void {
        // If it was previously removed and is now back with the same ID,
        // treat it as modified (the BSP knew about the old version).
        if (this._removed.delete(id)) {
            this._modified.add(id);
            return;
        }
        this._added.add(id);
    }

    /** Mark an edge as modified (same ID, changed geometry). */
    markModified(id: IEntityKey): void {
        // If it's already in added, it stays in added (still new to the BSP).
        if (this._added.has(id)) return;
        // If it's in removed, that's contradictory — ignore (edge is gone).
        if (this._removed.has(id)) return;
        this._modified.add(id);
    }

    /** Apply a batch diff in one call. */
    applyDiff(diff: IEdgeDiff): void {
        for (const id of diff.removedEdgeIds) this.markRemoved(id);
        for (const id of diff.addedEdgeIds) this.markAdded(id);
        for (const id of diff.modifiedEdgeIds) this.markModified(id);
    }

    /** Reset all dirty tracking (call after a successful BSP rebuild). */
    clear(): void {
        this._removed.clear();
        this._added.clear();
        this._modified.clear();
    }
}
