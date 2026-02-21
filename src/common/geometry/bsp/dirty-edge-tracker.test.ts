import { DirtyEdgeTracker, EMPTY_DIFF, IEdgeDiff } from './dirty-edge-tracker';

describe('DirtyEdgeTracker', () => {
    let tracker: DirtyEdgeTracker;

    beforeEach(() => {
        tracker = new DirtyEdgeTracker();
    });

    describe('initial state', () => {
        it('starts clean', () => {
            expect(tracker.isClean).toBe(true);
            expect(tracker.dirtyCount).toBe(0);
        });

        it('has an empty diff', () => {
            const diff = tracker.diff;
            expect(diff.removedEdgeIds.size).toBe(0);
            expect(diff.addedEdgeIds.size).toBe(0);
            expect(diff.modifiedEdgeIds.size).toBe(0);
        });
    });

    describe('markRemoved', () => {
        it('marks an edge as removed', () => {
            tracker.markRemoved('e1');
            expect(tracker.isClean).toBe(false);
            expect(tracker.dirtyCount).toBe(1);
            expect(tracker.diff.removedEdgeIds).toContain('e1');
        });

        it('clears from modified when removed', () => {
            tracker.markModified('e1');
            tracker.markRemoved('e1');
            expect(tracker.diff.modifiedEdgeIds.size).toBe(0);
            expect(tracker.diff.removedEdgeIds).toContain('e1');
        });

        it('cancels out with added (born-and-died between rebuilds)', () => {
            tracker.markAdded('e1');
            tracker.markRemoved('e1');
            // Edge was added then removed before rebuild — net nothing
            expect(tracker.isClean).toBe(true);
            expect(tracker.diff.removedEdgeIds.size).toBe(0);
            expect(tracker.diff.addedEdgeIds.size).toBe(0);
        });

        it('is idempotent', () => {
            tracker.markRemoved('e1');
            tracker.markRemoved('e1');
            expect(tracker.dirtyCount).toBe(1);
        });
    });

    describe('markAdded', () => {
        it('marks an edge as added', () => {
            tracker.markAdded('e1');
            expect(tracker.isClean).toBe(false);
            expect(tracker.dirtyCount).toBe(1);
            expect(tracker.diff.addedEdgeIds).toContain('e1');
        });

        it('converts removed-then-added to modified (re-added same ID)', () => {
            tracker.markRemoved('e1');
            tracker.markAdded('e1');
            expect(tracker.diff.removedEdgeIds.size).toBe(0);
            expect(tracker.diff.addedEdgeIds.size).toBe(0);
            expect(tracker.diff.modifiedEdgeIds).toContain('e1');
        });
    });

    describe('markModified', () => {
        it('marks an edge as modified', () => {
            tracker.markModified('e1');
            expect(tracker.isClean).toBe(false);
            expect(tracker.dirtyCount).toBe(1);
            expect(tracker.diff.modifiedEdgeIds).toContain('e1');
        });

        it('is a no-op if edge is already added (still new)', () => {
            tracker.markAdded('e1');
            tracker.markModified('e1');
            expect(tracker.diff.addedEdgeIds).toContain('e1');
            expect(tracker.diff.modifiedEdgeIds.size).toBe(0);
            expect(tracker.dirtyCount).toBe(1);
        });

        it('is a no-op if edge is already removed', () => {
            tracker.markRemoved('e1');
            tracker.markModified('e1');
            expect(tracker.diff.removedEdgeIds).toContain('e1');
            expect(tracker.diff.modifiedEdgeIds.size).toBe(0);
            expect(tracker.dirtyCount).toBe(1);
        });

        it('is idempotent', () => {
            tracker.markModified('e1');
            tracker.markModified('e1');
            expect(tracker.dirtyCount).toBe(1);
        });
    });

    describe('applyDiff', () => {
        it('applies a batch diff', () => {
            const diff: IEdgeDiff = {
                removedEdgeIds: new Set(['r1', 'r2']),
                addedEdgeIds: new Set(['a1']),
                modifiedEdgeIds: new Set(['m1', 'm2']),
            };
            tracker.applyDiff(diff);
            expect(tracker.dirtyCount).toBe(5);
            expect(tracker.diff.removedEdgeIds).toEqual(new Set(['r1', 'r2']));
            expect(tracker.diff.addedEdgeIds).toEqual(new Set(['a1']));
            expect(tracker.diff.modifiedEdgeIds).toEqual(new Set(['m1', 'm2']));
        });

        it('merges with existing dirty state', () => {
            tracker.markAdded('a1');
            tracker.applyDiff({
                removedEdgeIds: new Set(['a1']),  // removes the just-added edge
                addedEdgeIds: new Set(['a2']),
                modifiedEdgeIds: new Set(),
            });
            // a1 was added then removed → cancelled
            expect(tracker.diff.addedEdgeIds).toEqual(new Set(['a2']));
            expect(tracker.diff.removedEdgeIds.size).toBe(0);
        });
    });

    describe('clear', () => {
        it('resets all tracking', () => {
            tracker.markRemoved('r1');
            tracker.markAdded('a1');
            tracker.markModified('m1');
            expect(tracker.isClean).toBe(false);

            tracker.clear();
            expect(tracker.isClean).toBe(true);
            expect(tracker.dirtyCount).toBe(0);
        });
    });

    describe('diff returns a snapshot', () => {
        it('does not share internal sets', () => {
            tracker.markAdded('e1');
            const snapshot = tracker.diff;
            tracker.markAdded('e2');
            // Snapshot should be unchanged
            expect(snapshot.addedEdgeIds.size).toBe(1);
            expect(tracker.diff.addedEdgeIds.size).toBe(2);
        });
    });

    describe('complex scenarios', () => {
        it('handles add → modify → remove (full lifecycle)', () => {
            tracker.markAdded('e1');
            tracker.markModified('e1');  // no-op, still added
            expect(tracker.diff.addedEdgeIds).toContain('e1');
            expect(tracker.diff.modifiedEdgeIds.size).toBe(0);

            tracker.markRemoved('e1');  // cancels with added
            expect(tracker.isClean).toBe(true);
        });

        it('handles remove → add (same ID reappears)', () => {
            tracker.markRemoved('e1');
            tracker.markAdded('e1');  // becomes modified
            expect(tracker.diff.modifiedEdgeIds).toContain('e1');
            expect(tracker.diff.removedEdgeIds.size).toBe(0);
            expect(tracker.diff.addedEdgeIds.size).toBe(0);
        });

        it('handles many edges independently', () => {
            tracker.markRemoved('r1');
            tracker.markRemoved('r2');
            tracker.markAdded('a1');
            tracker.markAdded('a2');
            tracker.markAdded('a3');
            tracker.markModified('m1');

            expect(tracker.dirtyCount).toBe(6);
            expect(tracker.diff.removedEdgeIds).toEqual(new Set(['r1', 'r2']));
            expect(tracker.diff.addedEdgeIds).toEqual(new Set(['a1', 'a2', 'a3']));
            expect(tracker.diff.modifiedEdgeIds).toEqual(new Set(['m1']));
        });
    });

    describe('EMPTY_DIFF constant', () => {
        it('has empty sets', () => {
            expect(EMPTY_DIFF.removedEdgeIds.size).toBe(0);
            expect(EMPTY_DIFF.addedEdgeIds.size).toBe(0);
            expect(EMPTY_DIFF.modifiedEdgeIds.size).toBe(0);
        });

        it('is frozen', () => {
            expect(Object.isFrozen(EMPTY_DIFF)).toBe(true);
        });
    });
});
