# Incremental BSP: Automatic Regeneration with Dirty Edge Tracking

## Problem Statement

Currently, any geometry mutation nullifies the BSP tree (`bsp: null` in `geometry.ts`), causing the renderer to fall back to brute-force raycasting until the user manually rebuilds BSP with Ctrl+B. Additionally, maps loaded without a stored BSP require manual regeneration.

## Goals

1. **Keep the stale BSP usable** after geometry changes — no fallback to brute force
2. **Track which edges changed** so they can be supplemented alongside the stale BSP walk
3. **Regenerate BSP asynchronously** in a Web Worker without blocking rendering
4. **Auto-generate BSP** for maps loaded without one
5. **Clean up dirty state** once the new BSP is ready
6. **Support transient geometry changes** (e.g., rotating doors) that should not trigger BSP regeneration

## Core Concept

Instead of setting `bsp: null` on mutation, we keep the old BSP tree and maintain a **dirty edge set** — edges that were added, removed, or modified since the BSP was last built. During rendering, we walk the stale BSP (skipping dirty edges encountered in the tree) and separately test dirty edges against the camera/rays via a spatial index. Once a new BSP is built asynchronously in a Web Worker, the dirty set is cleared.

Dirty edges are partitioned into **permanent** (editor changes that require BSP rebuild) and **transient** (game mechanics like doors that revert to original state). The BSP always represents the **resting state** of the world.

## Architecture Overview

```
  [User edits geometry]          [File loaded / New file]     [Game mechanics]
        │                               │                          │
        ▼                               ▼                          ▼
  ┌─────────────────────┐    ┌────────────────────────┐   ┌──────────────────┐
  │  Geometry Mutation   │    │  loadWalls / clear     │   │  Game Logic      │
  │  (walls slice)       │    │  (walls slice)         │   │  (door/platform) │
  │  No longer clears    │    └───────────┬────────────┘   └────────┬─────────┘
  │  BSP                 │                │                         │
  └──────────┬───────────┘                │                         │
             │                            │                         │
             │  permanent dirty           │                         │  transient dirty
             ▼                            ▼                         ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  bspState slice                                                          │
  │                                                                          │
│  staleBsp: IBSPNode | null                                               │
│  dirtyTracker: IDirtyEdgeTracker                                         │
│    ├─ permanent partition  ──► triggers BSP regeneration                  │
│    └─ transient partition  ──► does NOT trigger BSP regeneration          │
│  isGenerating: boolean                                                   │
│  generationId: number                                                    │
  └──────────────────┬───────────────────────────────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  BspGenerationService                             │
  │                                                   │
  │  Subscribes to bspState. Triggers generation:     │
  │  • needsFullBuild=true → immediate (no debounce)  │
  │  • permanentGeneration changed → debounced         │
  │  • Ctrl+B → force immediate                       │
  │                                                   │
  │  Before posting to worker: substitute transient    │
  │  edges with their stored originals to build the    │
  │  resting-state BSP.                                │
  │                                                   │
  │  Cancels in-flight worker on new edits.            │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  Rendering Loop                                   │
  │                                                   │
  │  staleBsp exists?                                 │
  │  ├─ YES: BSP walk (skip ALL stale edges)          │
  │  │       + dirty edge spatial index query          │
  │  │       → merge into ZBuffer / ray hits           │
  │  │       (renderers don't care permanent/transient)│
  │  │                                                │
  │  └─ NO:  Brute-force raycaster (as today)         │
  │          (only during initial load before first    │
  │           BSP is generated)                        │
  └──────────────────────────────────────────────────┘
```

## Two Categories of Geometry Change

| | **Permanent** | **Transient** |
|---|---|---|
| **Examples** | Editor operations: move vertex, split edge, extrude, add polygon | In-game mechanics: rotating door, sliding wall, moving platform |
| **BSP impact** | Old BSP is permanently wrong, must rebuild | Old BSP is temporarily wrong, will become correct again |
| **Dirty tracking** | Edges go into permanent dirty set, trigger BSP regeneration | Edges go into transient dirty set, do NOT trigger BSP regeneration |
| **Lifecycle** | Dirty until new BSP is built | Dirty for a bounded duration, then restored |
| **Initiated by** | User in editor mode | Game logic / player interaction |

### Texture / Material Changes at Runtime

Changing a texture or material on an edge does **not** require dirty tracking. The BSP structure depends only on edge geometry (vertex positions → splitting planes), not materials. Material changes are applied by **mutating the edge objects in-place** on the polygon references stored inside the BSP tree. Since the BSP holds direct references to `IPolygon` objects (see `model.ts` lines 6-7: `polygons: IPolygon[]`, `coplanar: IPolygon[]`), mutating material properties on those edges is safe and immediately visible to the renderer during the next BSP walk. This avoids any overhead from the dirty tracking system for what is a purely visual change.

## Module Breakdown

### Module 1: DirtyEdgeTracker — Pure Data Structure

**File:** `src/common/geometry/bsp/dirty-edge-tracker.ts` — **IMPLEMENTED (Phase 1)**

Tracks which edges have been modified since the last BSP rebuild. Three categories: removed, added, modified. Phase 1 implements the permanent partition only; transient partition deferred to Phase 7.

**Implemented types:**

```typescript
interface IEdgeDiff {
    readonly removedEdgeIds: ReadonlySet<IEntityKey>;
    readonly addedEdgeIds: ReadonlySet<IEntityKey>;
    readonly modifiedEdgeIds: ReadonlySet<IEntityKey>;
}

const EMPTY_DIFF: IEdgeDiff;  // frozen singleton for identity checks

class DirtyEdgeTracker {
    get isClean(): boolean;
    get dirtyCount(): number;
    get diff(): IEdgeDiff;  // snapshot copy

    markRemoved(id: IEntityKey): void;
    markAdded(id: IEntityKey): void;
    markModified(id: IEntityKey): void;
    applyDiff(diff: IEdgeDiff): void;
    clear(): void;
}
```

**Implementation notes (deviations from original plan):**
- The plan described an `IDirtyEdgeTracker` interface with permanent/transient partitions, generation counters, and combined views. The actual implementation is simpler: a `DirtyEdgeTracker` class with three internal Sets (removed/added/modified) and an `IEdgeDiff` snapshot type.
- Smart cancellation logic handles sequences like added-then-removed (net no-op), removed-then-added (becomes modified), modified-on-added (stays added).
- The `IEdgeDiff` type uses `ReadonlySet` for external safety. Inside Redux state (`bspState`), a mutable `IMutableEdgeDiff` variant is used to work with Immer drafts.
- Transient partition, `permanentGeneration` counter, `transientOriginals`, and combined views are deferred to Phase 7.
- 21 tests in `dirty-edge-tracker.test.ts`.

**Future (Phase 7):** Add transient partition with original edge storage, `updateTransient`/`restoreTransient` operations, and combined views for renderers.

### Module 2: DirtyEdgeSpatialIndex — Render-time Acceleration

**File:** `src/common/geometry/bsp/dirty-edge-index.ts`

Lightweight AABB grid (uniform spatial hash) over dirty edges. Avoids brute-force iteration over all dirty edges during rendering. Indexes `allDirtyEdges` from the tracker — it doesn't distinguish permanent from transient.

```typescript
interface IDirtyEdgeIndex {
    queryFrustum(planes: FrustumPlanes): IEdge[];
    queryRay(ray: IRay): IEdge[];
}

function buildDirtyEdgeIndex(edges: IEdge[], worldBounds: Vector): IDirtyEdgeIndex;
```

**Design notes:**
- Divide world bounds into grid cells, assign each dirty edge to overlapping cells
- For ZBuffer path: collect dirty edges from cells overlapping the frustum
- For raycaster path: collect dirty edges from cells the ray passes through
- Complexity: O(cells touched) per query instead of O(all dirty edges)
- Renderer caches the index + `generation` counter; rebuilds only when generation changes
- Transient edges that update every frame (e.g., rotating door) bump `generation` each time, causing index rebuild. This is acceptable: the index is cheap to build for small dirty sets, and transient changes typically involve few edges.

### Module 3: bspState Redux Slice

**File:** `src/common/store/bsp-state.ts` — **IMPLEMENTED (Phase 1)**

Separates BSP lifecycle from the geometry model. The `bsp` field has been removed from `IGeometry`; the BSP now lives here. Requires Immer's `enableMapSet()` plugin because the state stores `Set` objects inside Immer-managed drafts.

**Implemented state:**

```typescript
type BspStatus = 'none' | 'fresh' | 'stale' | 'rebuilding';

interface IMutableEdgeDiff {
    removedEdgeIds: Set<IEntityKey>;
    addedEdgeIds: Set<IEntityKey>;
    modifiedEdgeIds: Set<IEntityKey>;
}

interface IBspState {
    tree: IBSPNode | null;            // current BSP tree (may be stale), null = no tree
    status: BspStatus;                 // lifecycle status
    dirtyEdges: IMutableEdgeDiff;      // accumulated dirty edges since last rebuild
    dirtyCount: number;                // convenience total for UI
}
```

**Implemented reducers:**

| Reducer | Purpose |
|---------|---------|
| `setBsp` | Set BSP tree after build completes or on load. Clears dirty tracking, sets status to `'fresh'` (or `'none'` if null). |
| `markDirty` | Merge incoming `IEdgeDiff` into accumulated dirty state. Smart merge logic matches `DirtyEdgeTracker` semantics (added-then-removed cancels, removed-then-added becomes modified, etc.). Sets status to `'stale'` if currently `'fresh'`. |
| `setRebuilding` | Signal that an async rebuild has started. Sets status to `'rebuilding'`. |

**Implementation notes (deviations from original plan):**
- The plan described `staleBsp`, `dirtyTracker: IDirtyEdgeTracker`, `isGenerating`, `generationId`, `needsFullBuild`. The actual implementation uses a simpler `BspStatus` enum (`'none' | 'fresh' | 'stale' | 'rebuilding'`) replacing the boolean flags, and stores dirty edges as `IMutableEdgeDiff` (mutable Sets) instead of an `IDirtyEdgeTracker` object.
- `IMutableEdgeDiff` uses mutable `Set` (not `ReadonlySet`) because Immer needs to proxy them. The external `IEdgeDiff` uses `ReadonlySet` for safety at API boundaries.
- `enableMapSet()` from Immer is called at module load time to support Sets in Redux state.
- The `markDirty` reducer performs the same smart merge logic as `DirtyEdgeTracker.applyDiff()` — it's duplicated here because the Redux state needs direct mutation rather than class method calls.
- The logger middleware in `index.ts` filters `bsp` actions (alongside `stats` and `player`) to reduce console noise.
- `generationId`, `needsFullBuild`, and transient-related reducers (`installInitialBsp`, `requestFullBuild`, `cancelGeneration`, transient reducers) are deferred to later phases.

**Phase 5 update:** The `clearBsp` reducer was removed as dead code. It was only dispatched by the `loadWalls → clearBsp` middleware listener, which was also removed (see Module 6). `setBsp(null)` produces the same state (`status: 'none'`, empty dirty tracking) and is used instead where needed.

**Future phases:**
- Phase 4: Add `generationId`, `isGenerating` semantics, `cancelGeneration`
- ~~Phase 5: Add `needsFullBuild`, `installInitialBsp`, `requestFullBuild`~~ — Not needed; existing `setBsp` + `BspGenerationService` `status === 'none'` handling covers all file load scenarios
- Phase 7: Add transient reducers (`markTransientDirty`, `updateTransient`, `restoreTransient`)

### Cross-Slice Operation: `restoreTransient` Thunk

`restoreTransient` is special because it must atomically update **both** the geometry (in `walls` slice) and the dirty tracker (in `bspState` slice). If these are separate dispatches, there's a frame between them where geometry has the originals but the tracker still lists them as dirty (or vice versa), causing rendering glitches.

**Implementation:** A Redux thunk (not a plain action) that:

```typescript
function restoreTransient(edgeIds: string[]): AppThunk {
    return (dispatch, getState) => {
        const tracker = getState().bspState.dirtyTracker;
        const originals = edgeIds.map(id => tracker.transientOriginals.get(id));

        // Single batch of dispatches (Redux batches by default in thunks)
        dispatch(wallActions.restoreEdges({ edgeIds, originals }));
        dispatch(bspStateActions.restoreTransient(edgeIds));
    };
}
```

This eliminates floating-point drift: instead of the game logic re-computing "original" positions (which may differ by epsilon from the BSP's version), the tracker's stored originals are authoritative and are placed directly back into the geometry.

**File:** `src/common/store/bsp-state.ts` (thunk export alongside the slice)

### Module 4: Changes to Geometry Mutations + Edge Diff Middleware

**Files:**
- `src/common/geometry/geometry.ts` — **IMPLEMENTED (Phase 1)**
- `src/common/store/walls.ts` — **IMPLEMENTED (Phase 1)**
- `src/common/store/bsp-middleware.ts` — **IMPLEMENTED (Phase 1, new file not in original plan)**

**Major architectural deviation from original plan:**

The plan proposed making mutation functions return `GeometryMutationResult` with edge diffs. Instead, we kept geometry functions **pure and unchanged** and compute diffs in an **RTK listener middleware** by comparing geometry state before and after `walls/*` actions.

**Implemented approach — Listener middleware:**

```typescript
// src/common/store/bsp-middleware.ts
const bspListenerMiddleware = createListenerMiddleware();

// All walls/* actions (except loadWalls) → compute edge diff → markDirty
// loadWalls is excluded because the caller (stateLoader) dispatches setBsp() directly,
// which correctly handles both cases (setBsp(tree) for files with BSP, setBsp(null) for files without).
bspListenerMiddleware.startListening({
    predicate: isWallsMutationAction,  // excludes loadWalls
    effect: async (_action, listenerApi) => {
        const oldGeometry = (listenerApi.getOriginalState() as RootState).walls.geometry;
        const newGeometry = (listenerApi.getState() as RootState).walls.geometry;
        const diff = computeEdgeDiff(oldGeometry, newGeometry);
        if (diff !== EMPTY_DIFF) {
            listenerApi.dispatch(markDirty(diff));
        }
    },
});
```

**Edge diff computation (`computeEdgeDiff`):**
- Short-circuits on reference equality (same geometry object → no diff)
- Two-tier targeted diff (performance improvement over original conservative approach):
  1. **Polygon-level**: Compares polygon arrays by reference equality — unchanged polygons are skipped entirely
  2. **Vertex-level**: For changed polygons, compares individual edge vertex positions to detect actual modifications
- Three diff categories: `removedEdgeIds` (in old, not new), `addedEdgeIds` (in new, not old), `modifiedEdgeIds` (in both but with changed vertex positions)
- Returns `EMPTY_DIFF` singleton for identity-check fast path

**Geometry changes (Phase 1):**
- `bsp` field removed from `IGeometry` and `IStoredGeometry` types
- `bsp` removed from `EMPTY_GEOMETRY`, `storeGeometry`, `loadGeometry`
- `bsp: null` removed from all 5 mutation sites: `addPolygon`, `forkPolygons`, `duplicatePolygons`, `insetPolygon`, `mergePolygons`
- `updateBsp` reducer removed from walls slice

**Why this deviated from the plan:**
- Changing mutation function signatures would have required modifying ~20 mutation functions and their callers in the walls slice
- The listener middleware approach keeps geometry functions pure — they don't need to know about BSP at all
- `getOriginalState()` gives us the pre-action state for free, enabling clean diffing
- ~~Conservative modification tracking (all surviving IDs treated as "modified") is correct because the BSP dirty tracker handles no-op modifications gracefully~~ — Replaced with two-tier targeted diff: polygon reference equality skips unchanged polygons, vertex position comparison detects actual modifications
- The middleware is prepended to the middleware chain (before logger) so it runs after reducers but before side effects

**Additional files modified for BSP parameter threading (not in original plan):**
Removing `bsp` from `IGeometry` required threading BSP as a separate parameter through the rendering and collision chain:
- `src/common/camera.ts` — `move()`, `strafe()`, `constrainedMove()` accept `bspContext?: IBspContext`
- `src/common/store/player.ts` — action payloads include `bspContext` field
- `src/common/rendering/renderer-core.ts` — `IRendererCore.render()` has `bspContext` param
- `src/common/rendering/raycasting/raycaster.ts` — all BSP-using functions accept `bsp` param (collision-only functions like `castCollisionRays` take raw `bsp`, rendering functions take `bspContext`)
- `src/common/rendering/raycasting/raycast-core.ts` — `render()` accepts and passes `bspContext` param
- `src/common/rendering/zbuffering/zbuffer-core.ts` — `render()` accepts and uses `bspContext` param
- `src/common/rendering/zbuffering/zbuffer-renderer.ts` — reads BSP from `bspState` via `connect()`, stores as `bspContext` field
- `src/common/rendering/raycasting/renderer3d.ts` — reads BSP from bspState via `connect()`
- `src/common/actions/cameraActionsHandler.ts` — subscribes to `s.bsp`, stores `bspContext`, dispatches with `bspContext`
- `src/common/editor/mapEditor.ts` — subscribes to `s.bsp.tree`
- `src/common/rendering/bspwalking/walker.ts` — subscribes to `s.bsp.tree`, `isActive()` uses `!!this.bspTree`
- `src/common/geometry/bsp/bsp-generation-service.ts` — subscribes to `bspState` via `connect()`, debounces edits, posts to web worker, dispatches `setBsp`; replaces deleted `bspGenerationStarter.ts`
- `src/common/storage/stateLoader.ts` — BSP save/load from bspState, legacy compatibility

**IBspContext bundling (post-Phase 2 refactor):**
After Phase 2 introduced `dirtyEdges` alongside `bsp` in many function signatures, the two were bundled into a single `IBspContext` type (defined in `bsp-state.ts`):

```typescript
interface IBspContext {
    readonly tree: IBSPNode | null;
    readonly dirtyEdges: IMutableEdgeDiff;
}
```

Functions that previously took `(bsp?, dirtyEdges?)` as separate params now take `(bspContext?: IBspContext)` and destructure inside. This affected:
- `renderer-core.ts` — `IRendererCore.render()` signature
- `zbuffer-core.ts` — `ZBufferCore.render()`
- `raycast-core.ts` — `RaycastCore.render()`
- `raycaster.ts` — `castCameraRay()`
- `camera.ts` — `move()`, `strafe()`, `constrainedMove()`
- `player.ts` — `moveCamera`/`strafeCamera` payload types
- `cameraActionsHandler.ts` — single `bspContext` field instead of `bspTree` + `dirtyEdges`
- `zbuffer-renderer.ts` — single `bspContext` field instead of `bspTree` + `dirtyEdges`
- `geometry.factory.ts` — `IGeometryWithBsp` type, `withBsp()` returns `{ geometry, bsp, bspContext }`

Functions that ONLY use `bsp` (not `dirtyEdges`) were NOT changed: `castCollisionRays`, `castRays`, `detectCollisions`, `walker`, `mapEditor`, `renderer3d`.

**Test file updates (10 files):**
- `geometry.test.ts`, `store.test.ts`, `factories.test.ts`, `raycaster.test.ts`, `camera.test.ts`, `renderer-comparison.test.ts`, `raycast-core.test.ts`, `zbuffer.test.ts`, `rendering.benchmark.test.ts`, `allocation.benchmark.test.ts`
- Factory `geometry.factory.ts` — added `IGeometryWithBsp` type, `withBsp()` returns `{ geometry, bsp, bspContext }`

**Middleware tests:** 20 tests in `bsp-middleware.test.ts` covering all geometry mutations, undo/redo, no-op detection, accumulation, and cancellation semantics.

### Module 5: BspGenerationService — Async Orchestration

**File:** `src/common/geometry/bsp/bsp-generation-service.ts`

**Replaces:** the existing `BspGenerationStarter` (`src/common/geometry/bsp/bspGenerationStarter.ts`).

Subscribes to `bspState` and reacts to triggers:

| Trigger | Behavior |
|---------|----------|
| `permanentGeneration` changed | Cancel in-flight worker. Start debounce timer (300-500ms). On expiry, post resting-state polygons to worker. |
| `status === 'none'` with polygons | Cancel in-flight worker. Start generation **immediately** (no debounce). This covers file-load-without-BSP and new file. (Originally planned as `needsFullBuild` flag, but `status === 'none'` is sufficient.) |
| Ctrl+B (manual) | Cancel in-flight worker + cancel debounce timer. Start generation immediately. |

**Resting-state polygon preparation (before posting to worker):**

```
1. Take current geometry polygons
2. For each transient-dirty edge (from transientOriginals):
   a. If original is non-null: substitute the edge with its original
   b. If original is null: remove the edge (it's transient extra geometry)
3. Post the resting-state polygons to worker
```

This ensures the BSP always represents the world at rest, regardless of active game mechanics.

**Worker protocol:**
- Post: `{ polygons, generationId }`
- Receive: `{ bsp, generationId }`
- If received `generationId` doesn't match current, result is discarded (edit happened during generation).

**Cancellation:** Terminate the worker and create a new one (simplest approach), or use a message-based cancellation flag if the worker can check between recursion levels of `buildBspTree`.

**Existing worker:** `src/workers/bspGenerator.ts` already exists and calls `buildBspTree`. It needs the `generationId` added to the message protocol.

**Implementation notes (deviations from original plan):**

The actual implementation differs from the plan above in several ways:

1. **`BspStatus` enum triggers instead of `permanentGeneration`/`needsFullBuild`**: The service reacts to `bspState.status` values (`'stale'`, `'none'`, `'rebuilding'`, `'fresh'`) via `connect()` subscription rather than individual boolean fields.

2. **Option A for concurrent edits (accept + re-queue)**: Instead of cancelling in-flight workers on new edits, the service accepts the worker result and checks if `dirtyCount` changed during generation. If so, it dispatches the result (still an improvement) and re-queues. This avoids wasting completed work.

3. **No resting-state polygon substitution**: Transient partition (Phase 7) is not yet implemented, so the worker receives current polygons directly without transient→original substitution.

4. **Debounce behavior**: 500ms debounce (configurable via constructor). The debounce timer is only started when `status === 'stale'` AND no timer/generation is already running. Unrelated Redux dispatches do NOT restart the timer.

5. **`status === 'none'` triggers immediate generation** (no debounce) when polygons exist — covers file load without stored BSP.

6. **Ctrl+B via IPC `'bsp_generate'`**: Cancels any active debounce timer and in-flight generation, then starts immediate generation. `mainmenu.ts` was NOT modified — the same IPC channel is used, just the receiver changed from `BspGenerationStarter` to `BspGenerationService`.

7. **Typed worker protocol**: `BspWorkerRequest { type: 'generate', polygons, generationId }` and `BspWorkerResponse { type: 'result', bsp, generationId }` — more structured than originally planned.

8. **Critical ordering in result handler**: `editsArrivedDuringGeneration` check happens BEFORE `dispatch(setBsp())` because `setBsp` resets `dirtyCount` to 0 synchronously via `connect()` callback.

9. **22 tests** in `bsp-generation-service.test.ts` covering debounce timing, worker message protocol, dirty re-queue logic, Ctrl+B immediate generation, status transitions, and cleanup.

### Module 6: File Load Integration — **IMPLEMENTED (Phase 5)**

**Files:**
- `src/common/store/bsp-middleware.ts` — **Modified**
- `src/common/store/bsp-state.ts` — **Modified**
- `src/common/store/bsp-middleware.test.ts` — **Modified**
- `src/common/geometry/bsp/bsp-generation-service.test.ts` — **Modified**

**Original plan** proposed new actions (`installInitialBsp`, `requestFullBuild`) and modifications to `stateLoader.ts`:

```typescript
dispatch(wallActions.loadWalls(geometry));

if (loadedGeometry.bsp) {
    dispatch(bspStateActions.installInitialBsp(loadedGeometry.bsp));
} else {
    dispatch(bspStateActions.requestFullBuild());
    // BspGenerationService sees needsFullBuild=true → starts worker immediately
}
```

**Actual implementation — much simpler:**

Analysis revealed that Phase 5 was ~90% already done by the existing `BspGenerationService`'s `status === 'none'` handling (from Phase 4). The `loadWorld` function already dispatches `setBsp(bsp)` at `stateLoader.ts:153`, which handles both cases:
- `setBsp(tree)` → `status: 'fresh'` → no worker spawned
- `setBsp(null)` → `status: 'none'` → service auto-generates

**The only issue was a race condition for files WITH stored BSP:**
1. `loadWorld()` dispatches `loadWalls(geometry)` → bsp-middleware fired `clearBsp()` → `status: 'none'`
2. `BspGenerationService.onStateChange()` sees `'none'` + polygons → spawns unnecessary worker
3. `loadWorld()` then dispatches `setBsp(loadedBsp)` → `status: 'fresh'`
4. Worker completes later → overwrites the perfectly good loaded BSP

**The fix:** Remove the `loadWalls → clearBsp` middleware listener entirely. Dependency analysis confirmed safe: `loadWalls` is only dispatched from `stateLoader.ts:148`. `clearBsp` was only dispatched from the middleware. `setBsp(null)` produces identical state to `clearBsp`. No other code depends on `clearBsp`.

**Additional cleanup:** The `clearBsp` reducer was removed from `bsp-state.ts` as dead code (no remaining callers after middleware listener removal). Removed from exports.

**No new actions needed.** `installInitialBsp` and `requestFullBuild` were NOT created — the existing `setBsp` action and `BspGenerationService`'s `status === 'none'` handling cover all file load scenarios.

On **save**: `storeGeometry` serializes `bspState.staleBsp` (not `geometry.bsp` which no longer exists). Only the latest fully-built BSP is saved — dirty state is transient. (Implemented in Phase 1.)

**Tests added:**
- `bsp-middleware.test.ts`: Replaced `'loadWalls triggers clearBsp'` test block with `'loadWalls does not affect bspState'` containing 2 tests (BSP state unchanged after loadWalls, loadWalls doesn't trigger markDirty).
- `bsp-generation-service.test.ts`: Added `'file load scenarios'` describe block with 3 tests (file with stored BSP, file without BSP, new file/empty geometry).

### Module 7: Renderer Integration — ZBuffer Path — **IMPLEMENTED (Phase 2)**

**Files:**
- `src/common/rendering/zbuffering/zbuffer-renderer.ts`
- `src/common/rendering/zbuffering/zbuffer-core.ts`

Both files implement a two-phase approach in `render()`:

**Phase 1 — BSP walk with stale filtering:**
During `walkWithFrustum`, each edge is checked via `isStaleInBsp(edge.id, dirtyEdges)`. Stale edges (in `removedEdgeIds` or `modifiedEdgeIds`) are skipped. The `ZBufferCore` variant counts these as `staleEdgesSkipped` in metrics.

**Phase 2 — Brute-force dirty edge iteration:**
After the BSP walk, `collectDirtyEdges(geometry, dirtyEdges)` collects edges from current geometry whose IDs appear in `addedEdgeIds` or `modifiedEdgeIds`. Each is clipped to the frustum and added to the ZBuffer (same code path as BSP edges). The `ZBufferCore` variant counts these as `dirtyEdgesTested` in metrics.

**Shared utilities (exported from `zbuffer-core.ts`):**
- `isStaleInBsp(edgeId, dirtyEdges)`: Returns true if edge ID is in `removedEdgeIds` or `modifiedEdgeIds`
- `collectDirtyEdges(geometry, dirtyEdges)`: Scans geometry for edges in `addedEdgeIds` or `modifiedEdgeIds`

**`ZBufferRenderer`** subscribes to `s.bsp` via `connect()` and stores an `IBspContext` field (bundling `tree` + `dirtyEdges`). **`ZBufferCore`** accepts `bspContext?: IBspContext` on `render()` and destructures `bsp` and `dirtyEdges` internally.

**Metrics extensions (`benchmark-types.ts`):**
- `RenderMetrics.staleEdgesSkipped?: number` — edges skipped in BSP walk
- `RenderMetrics.dirtyEdgesTested?: number` — dirty edges tested via brute-force

**Interface change (`renderer-core.ts`):**
- `IRendererCore.render()` has `bspContext?: IBspContext` parameter
- `RaycastCore.render()` accepts but ignores the `dirtyEdges` portion (destructures `bsp` only, interface conformance)

**Implementation notes (deviations from original plan):**
- The plan described querying a spatial index (`dirtyIndex.queryFrustum`). Phase 2 uses simple brute-force iteration instead — the spatial index is deferred to Phase 3.
- The plan described caching a `IDirtyEdgeIndex` and rebuilding on `generation` change. This is not yet implemented.
- `isActive()` was already updated in Phase 1 to use `!!this.bspTree` (reading from `bspState`).
- 17 tests added to `zbuffer.test.ts` covering stale edge skipping, dirty edge brute-force, metrics tracking, and edge case handling.

**Future (Phase 3):** Replace brute-force `collectDirtyEdges` with spatial index queries for better performance with large dirty sets.

### Module 8: Renderer Integration — Raycaster Path — **IMPLEMENTED**

**Files:**
- `src/common/rendering/raycasting/raycaster.ts`
- `src/common/rendering/raycasting/raycast-core.ts`
- `src/common/rendering/raycasting/renderer3d.ts`

**Implemented (collision — Phase 2):**
`castCameraRay(ray, geometry, bspContext?)` implements the two-phase approach for camera movement collision:
1. Phase 1: BSP traversal via `intersectRay()` with an `edgeFilter` that skips immaterial edges AND stale edges (`!edge.immaterial && !isStaleInBsp(edge.id, dirtyEdges)`)
2. Phase 2: `collectDirtyEdges(geometry, dirtyEdges)` iterates added/modified edges, skips immaterial ones, calls `intersectRayEdge()` on each, keeps the closest hit
3. Returns the closest hit from either phase

**Implemented (rendering — Phase 6):**
`castCollisionRays(rays, geometry, bspContext?)` now implements the same two-phase approach for raycaster rendering:
1. Phase 1: BSP traversal with an `edgeFilter` that skips materialless edges AND stale edges (`!!edge.material && !isStaleInBsp(edge.id, dirtyEdges)`)
2. Phase 2: `collectDirtyEdges(geometry, dirtyEdges)` iterates added/modified edges, skips materialless ones, tests each against every ray via `intersectRayEdge()`, inserts renderable hits into the ray's sorted hit array using binary search
3. Signature changed from `(rays, geometry, bsp?: IBSPNode | null)` to `(rays, geometry, bspContext?: IBspContext)` — BSP and dirty edges are extracted internally

`RaycastCore.render()` now passes the full `bspContext` to `castCollisionRays` instead of extracting only the BSP tree.

`Renderer3d` now stores `bspContext: IBspContext | null` instead of `bspTree: IBSPNode | null`, subscribes to both `s.bsp.tree` and `s.bsp.dirtyEdges` from Redux, and passes the full context to `castCollisionRays`.

Imports `isStaleInBsp` and `collectDirtyEdges` from `../zbuffering/zbuffer-core`.

**Also updated:** `renderer3d.ts` — `isActive()` uses `!this.bspContext?.tree` (reading from `bspState`).

### Module 9: Collision (Camera Movement) Integration — **IMPLEMENTED (Phase 2)**

**Files:**
- `src/common/camera.ts` — `move()`, `strafe()`, `constrainedMove()` accept optional `bspContext?: IBspContext`
- `src/common/store/player.ts` — `moveCamera` and `strafeCamera` payloads include `bspContext?: IBspContext`
- `src/common/actions/cameraActionsHandler.ts` — subscribes to `s.bsp`, stores `bspContext: IBspContext | null` field, passes in dispatches
- `src/common/rendering/raycasting/raycaster.ts` — `castCameraRay()` two-phase approach (see Module 8)

**Full call chain:**
```
CameraActionsHandler.handle()          [subscribes to s.bsp, stores bspContext]
  └─ dispatches moveCamera/strafeCamera with bspContext in payload
       └─ Player reducer                  [player.ts]
            └─ move() / strafe()          [camera.ts, accepts bspContext?]
                 └─ constrainedMove()     [camera.ts, destructures bsp + dirtyEdges]
                      └─ castCameraRay(ray, geometry, bsp, dirtyEdges)
                                          [raycaster.ts]
                           Phase 1: BSP traversal with stale filter
                           Phase 2: brute-force dirty edge collision
                           Return: closest hit from either phase
```

**Critical bug found and fixed during implementation:**
When the BSP became stale, the camera could pass through ALL geometry. Root cause: `castCameraRay` only did BSP traversal with the stale edge filter. Since conservative modification tracking marks ALL surviving edges as "modified", they were all skipped in the BSP walk. The fix was adding Phase 2 (brute-force dirty edge collision from current geometry).

**Tests:** 6 tests in `camera.test.ts` in `describe('move/strafe with dirty edges')` covering: baseline blocking, removed edges pass-through, modified edges still block (brute-force phase), empty diff equivalence, added edges block via brute-force, strafe respects removed edges.

### Module 10: BSP Status Indicator — Editor UI Feedback

**File:** `src/renderer/components/bspStatusComponent.ts` — **IMPLEMENTED (Phase 9)**

A Web Component (`<bsp-status>`) that displays the current BSP state in the editor. Uses a colored dot + text label for at-a-glance visibility. Placed in a new status bar row at the bottom of the editor layout.

**Visual states (as implemented):**

| BSP State | Dot Color | Label | When |
|-----------|-----------|-------|------|
| Fresh | Green (`#4caf50`) | `BSP` | `status === 'fresh'` |
| Stale | Yellow (`#ffb300`) | `BSP stale (N)` | `status === 'stale'` (N = dirty count) |
| Rebuilding | Yellow (`#ffb300`), pulsing | `BSP regenerating...` | `status === 'rebuilding'` |
| No BSP | Red (`#f44336`) | `No BSP` | `status === 'none'` and `tree === null` |

**Implemented component:**

```typescript
class BspStatusComponent extends HTMLElement {
    private dot: HTMLSpanElement;
    private label: HTMLSpanElement;
    private unsubscribe: (() => void) | null = null;
    private currentDotClass: DotClass | null = null;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRoot.appendChild(template.content.cloneNode(true));
        this.dot = shadowRoot.querySelector('.dot')!;
        this.label = shadowRoot.querySelector('.label')!;
    }

    connectedCallback() {
        this.unsubscribe = connect((state) => {
            const { status, tree, dirtyCount } = state.bsp;
            this.update(status, tree != null, dirtyCount);
        });
    }

    disconnectedCallback() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}

window.customElements.define('bsp-status', BspStatusComponent);
```

**Implementation notes (deviations from original plan):**
- The plan read `staleBsp`, `dirtyTracker`, `isGenerating`, `needsFullBuild` from state. The actual implementation reads `status` (BspStatus enum), `tree`, and `dirtyCount` — matching the simplified bspState shape.
- The stale label includes the dirty count (`BSP stale (N)`) for at-a-glance severity assessment, which was not in the original plan.
- The plan's `permanentGeneration > 0` check is replaced by `status === 'stale'`, which is set by the `markDirty` reducer.
- Uses a `currentDotClass` field to avoid unnecessary DOM updates when the status hasn't changed.
- The component efficiently updates only the CSS class and text content, not innerHTML.

**Shadow DOM template:**

```html
<style>
    :host {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-family: monospace;
        color: #ccc;
        padding: 0 8px;
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .dot.green  { background: #4caf50; }
    .dot.yellow { background: #ffb300; }
    .dot.red    { background: #f44336; }
    .dot.yellow-pulse {
        background: #ffb300;
        animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }
</style>
<span class="dot"></span>
<span class="label"></span>
```

**Layout integration:**

Add a status bar row to the HTML layout below the existing `tools` div:

```html
<div class="container">
    <div class="views"> ... </div>
    <div class="tools"> ... </div>
    <div class="status-bar">           <!-- NEW -->
        <bsp-status></bsp-status>
    </div>
</div>
```

The status bar uses the 5% height gap that currently exists below the container. Styled as a thin horizontal bar:

```css
/* In src/css/main.css */
.status-bar {
    display: flex;
    align-items: center;
    height: 20px;
    background: #252525;
    border-top: 1px solid #444;
    padding: 0 4px;
}
```

**Design notes:**
- Follows the existing Web Component pattern (Shadow DOM, `connect()` subscription)
- Yellow for stale/generating (not red) because the system is still rendering correctly via dirty edge tracking — it's degraded-but-functional, not broken
- Red only for the "no BSP" case where brute-force fallback is active
- Pulsing animation on the dot during generation provides activity feedback without being distracting
- The status bar is extensible — other indicators can be added later (selection mode, coordinate readout, etc.)
- The `permanentGeneration > 0` check correctly distinguishes "stale from edits" from "clean." After `completeGeneration`, permanent generation is reset, so the indicator returns to green even if transient changes are active (transient staleness is expected and doesn't concern the editor user)

## Phased Implementation Plan

| Phase | What | Status | System behavior |
|-------|------|--------|----------------|
| **1** | `DirtyEdgeTracker` + `bspState` slice + edge diff middleware + remove `bsp` from `IGeometry` + BSP parameter threading through rendering/collision chain. | **DONE** | BSP preserved across geometry mutations. Dirty edges tracked in Redux. BSP threaded as separate parameter. Stale edges still visible at old positions (Phase 2 fixes this). |
| **2** | BSP walk filter (skip stale edges) + brute-force dirty edge iteration (no spatial index yet) + collision dirty edge threading + `castCameraRay` two-phase approach | **DONE** | Correct rendering with stale BSP. Dirty edges tested via simple iteration. Camera movement respects dirty edges (added/modified block, removed pass through). |
| **3** | `DirtyEdgeSpatialIndex` | Pending | Performance optimization — spatial queries instead of iterating all dirty edges. |
| **4** | `BspGenerationService` with web worker, debounce, cancellation | **DONE** | Full async BSP regeneration. Dirty set auto-clears after edits stop. |
| **5** | File load integration: auto-generate BSP for maps loaded without one. Auto-generate on new file. | **DONE** | No more manual Ctrl+B needed for old maps or fresh starts. |
| **6** | Raycaster path + collision integration | **DONE** | Both camera movement collision and raycaster rendering path are fully dirty-edge-aware. |
| **7** | Transient partition — add transient tracking, original storage, `updateTransient`, `restoreTransient`, resting-state BSP build | Pending | Game mechanics (doors, platforms) can temporarily modify geometry without triggering BSP rebuild. |
| **8** | In-place material mutation — runtime texture/material changes on BSP edge objects | Pending | Texture changes without any dirty tracking overhead. |
| **9** | BSP status indicator — `<bsp-status>` component, status bar layout, `connect()` subscription to `bspState` | **DONE** | Editor shows green/yellow/red dot + label reflecting BSP health. |

Each phase is independently testable and the system stays functional throughout. Phases 1-6 deliver the core feature. Phases 7-8 add game-mechanic support and can be implemented when those features are needed. Phase 9 can be implemented as early as Phase 1 (once `bspState` exists) but is listed last because it's purely cosmetic.

## Files to Create/Modify

| File | Action | Phase | Status |
|------|--------|-------|--------|
| `src/common/geometry/bsp/dirty-edge-tracker.ts` | **Create** — `DirtyEdgeTracker` class, `IEdgeDiff`, `EMPTY_DIFF` | 1 | **DONE** |
| `src/common/geometry/bsp/dirty-edge-tracker.test.ts` | **Create** — 21 tests for DirtyEdgeTracker | 1 | **DONE** |
| `src/common/store/bsp-state.ts` | **Create** — Redux slice with `setBsp`, `markDirty`, `setRebuilding` + `enableMapSet()`. (`clearBsp` removed in Phase 5 as dead code.) | 1 | **DONE** |
| `src/common/store/bsp-middleware.ts` | **Create** — listener middleware computing edge diffs on `walls/*` actions. `loadWalls` excluded (caller dispatches `setBsp` directly). | 1 | **DONE** |
| `src/common/store/bsp-middleware.test.ts` | **Create** — 20 tests for bsp middleware + 2 tests for loadWalls exclusion (Phase 5) | 1 | **DONE** |
| `src/common/geometry/geometry.ts` | **Modify** — removed `bsp` from `IGeometry`/`IStoredGeometry`/`EMPTY_GEOMETRY`, removed all 5 `bsp: null` mutation sites | 1 | **DONE** |
| `src/common/store/walls.ts` | **Modify** — removed `updateBsp` reducer | 1 | **DONE** |
| `src/common/store/index.ts` | **Modify** — added `bsp` slice + `bspListenerMiddleware`, filtered `bsp` from logger | 1 | **DONE** |
| `src/common/geometry/bsp/bspGenerationStarter.ts` | **Modify** — dispatches `setBsp` from `bsp-state` instead of `updateBsp` from `walls` | 1 | **DONE** |
| `src/common/storage/stateLoader.ts` | **Modify** — save/load BSP from `bspState`, legacy compat for old files | 1 | **DONE** |
| `src/common/rendering/zbuffering/zbuffer-renderer.ts` | **Modify** — reads BSP from `bspState`, stores `bspContext` field, `isActive()` uses `this.bspContext?.tree` | 1 | **DONE** |
| `src/common/rendering/zbuffering/zbuffer-core.ts` | **Modify** — `render()` accepts `bspContext?: IBspContext` parameter | 1 | **DONE** |
| `src/common/rendering/raycasting/renderer3d.ts` | **Modify** — reads BSP from `bspState`, `isActive()` uses `!this.bspTree` | 1 | **DONE** (updated in Phase 6) |
| `src/common/rendering/raycasting/raycaster.ts` | **Modify** — BSP-using functions accept `bsp` param; `castCameraRay` accepts `bspContext` | 1 | **DONE** |
| `src/common/rendering/raycasting/raycast-core.ts` | **Modify** — `render()` accepts and passes `bspContext` param | 1 | **DONE** (updated in Phase 6) |
| `src/common/rendering/renderer-core.ts` | **Modify** — `IRendererCore.render()` has `bspContext?: IBspContext` param | 1 | **DONE** |
| `src/common/camera.ts` | **Modify** — `move()`/`strafe()`/`constrainedMove()` accept `bspContext?: IBspContext` | 1 | **DONE** |
| `src/common/store/player.ts` | **Modify** — action payloads use `bspContext?: IBspContext` | 1 | **DONE** |
| `src/common/actions/cameraActionsHandler.ts` | **Modify** — subscribes to `s.bsp`, stores `bspContext: IBspContext \| null`, dispatches with `bspContext` | 1 | **DONE** |
| `src/common/editor/mapEditor.ts` | **Modify** — added `bspTree` field, subscribes to `s.bsp.tree` | 1 | **DONE** |
| `src/common/rendering/bspwalking/walker.ts` | **Modify** — added `bspTree` field, `isActive()` uses `!!this.bspTree` | 1 | **DONE** |
| `src/common/testing/factories/geometry.factory.ts` | **Modify** — `IGeometryWithBsp` type, `withBsp()` returns `{ geometry, bsp, bspContext }` | 1 | **DONE** |
| `src/common/geometry/geometry.test.ts` | **Modify** — 2 BSP tests rewritten for new structure | 1 | **DONE** |
| `src/common/store/store.test.ts` | **Modify** — `updateBsp` test replaced, camera tests updated | 1 | **DONE** |
| `src/common/testing/factories/factories.test.ts` | **Modify** — `withBsp` tests updated for `{ geometry, bsp, bspContext }` return | 1 | **DONE** |
| `src/common/rendering/raycasting/raycaster.test.ts` | **Modify** — all BSP usages destructured, `castCameraRay` calls use `bspContext` | 1 | **DONE** |
| `src/common/camera.test.ts` | **Modify** — all `move`/`strafe` tests pass `bspContext` param | 1 | **DONE** |
| `src/common/rendering/renderer-comparison.test.ts` | **Modify** — both test blocks pass `bspContext` | 1 | **DONE** |
| `src/common/rendering/raycasting/raycast-core.test.ts` | **Modify** — all render calls pass `bspContext` | 1 | **DONE** |
| `src/common/rendering/zbuffering/zbuffer.test.ts` | **Modify** — all render calls pass `bspContext` | 1 | **DONE** |
| `src/common/rendering/rendering.benchmark.test.ts` | **Modify** — BSP separated, passes `bspContext` | 1 | **DONE** |
| `src/common/rendering/allocation.benchmark.test.ts` | **Modify** — BSP separated, passes `bspContext` | 1 | **DONE** |
| `src/common/rendering/zbuffering/zbuffer-renderer.ts` | **Modify** — stale skip guard in BSP walk, brute-force dirty edge iteration after walk, subscribe to `s.bsp`, stores `bspContext: IBspContext \| null` field | 2 | **DONE** |
| `src/common/rendering/zbuffering/zbuffer-core.ts` | **Modify** — `isStaleInBsp()` + `collectDirtyEdges()` exports, stale skip + brute-force + metrics in `render()`, accepts `bspContext?: IBspContext` | 2 | **DONE** |
| `src/common/rendering/benchmark-types.ts` | **Modify** — added `staleEdgesSkipped?` and `dirtyEdgesTested?` to `RenderMetrics` | 2 | **DONE** |
| `src/common/rendering/renderer-core.ts` | **Modify** — `IRendererCore.render()` accepts `bspContext?: IBspContext` | 2 | **DONE** |
| `src/common/rendering/raycasting/raycast-core.ts` | **Modify** — accepts `bspContext?: IBspContext`, destructures `bsp` for `castCollisionRays` | 2 | **DONE** (updated in Phase 6) |
| `src/common/rendering/zbuffering/zbuffer.test.ts` | **Modify** — 17 dirty edge tests added | 2 | **DONE** |
| `src/common/rendering/raycasting/raycaster.ts` | **Modify** — `castCameraRay()` accepts `bspContext?: IBspContext`, two-phase: BSP stale filter + brute-force `collectDirtyEdges` for collision | 2 (was 6) | **DONE** |
| `src/common/camera.ts` | **Modify** — `move()`/`strafe()`/`constrainedMove()` accept `bspContext?: IBspContext`, destructure `bsp` + `dirtyEdges` inside | 2 (was 6) | **DONE** |
| `src/common/store/player.ts` | **Modify** — `moveCamera`/`strafeCamera` payloads use `bspContext?: IBspContext` | 2 (was 6) | **DONE** |
| `src/common/actions/cameraActionsHandler.ts` | **Modify** — subscribes to `s.bsp`, stores single `bspContext: IBspContext \| null` field, dispatches with `bspContext` | 2 (was 6) | **DONE** |
| `src/common/camera.test.ts` | **Modify** — 6 dirty edge collision tests in `describe('move/strafe with dirty edges')` | 2 (was 6) | **DONE** |
| `src/common/geometry/bsp/dirty-edge-index.ts` | **Create** | 3 | Pending |
| `src/common/geometry/bsp/bsp-generation-service.ts` | **Create** | 4 | **DONE** |
| `src/common/geometry/bsp/bsp-generation-service.test.ts` | **Create** — 22 tests covering debounce, worker protocol, dirty re-queue, Ctrl+B + 3 file load scenario tests (Phase 5) | 4 | **DONE** |
| `src/common/geometry/bsp/bspGenerationStarter.ts` | **Deleted** — replaced by `BspGenerationService` | 4 | **DONE** |
| `src/workers/bspGenerator.ts` | **Modify** — typed `BspWorkerRequest`/`BspWorkerResponse` with `generationId` | 4 | **DONE** |
| `src/renderer/renderer.ts` | **Modify** — swapped `BspGenerationStarter` → `BspGenerationService` | 4 | **DONE** |
| `src/main/mainmenu.ts` | N/A — Ctrl+B IPC unchanged; `BspGenerationService` listens to same `'bsp_generate'` channel | 4 | **DONE** |
| `src/common/storage/stateLoader.ts` | N/A — NOT modified in Phase 5. Existing `setBsp(bsp)` dispatch already handles file load correctly. | 5 | **DONE** |
| `src/common/store/bsp-middleware.ts` | **Modify** — removed `loadWalls → clearBsp` listener, removed `clearBsp` import, updated comments | 5 | **DONE** |
| `src/common/store/bsp-state.ts` | **Modify** — removed `clearBsp` reducer (dead code after middleware change), removed from exports | 5 | **DONE** |
| `src/common/store/bsp-middleware.test.ts` | **Modify** — replaced `loadWalls/clearBsp` test with `loadWalls does not affect bspState` (2 tests) | 5 | **DONE** |
| `src/common/geometry/bsp/bsp-generation-service.test.ts` | **Modify** — added `file load scenarios` describe block (3 tests) | 5 | **DONE** |
| `src/common/rendering/raycasting/raycaster.ts` | **Modify** — `castCollisionRays()` accepts `IBspContext`, two-phase: BSP stale filter + brute-force `collectDirtyEdges` for rendering | 6 | **DONE** |
| `src/common/rendering/raycasting/raycast-core.ts` | **Modify** — passes full `bspContext` to `castCollisionRays` instead of extracting only `bsp` | 6 | **DONE** |
| `src/common/rendering/raycasting/renderer3d.ts` | **Modify** — stores `bspContext: IBspContext \| null`, subscribes to `s.bsp.tree` + `s.bsp.dirtyEdges`, `isActive()` uses `!this.bspContext?.tree` | 6 | **DONE** |
| `src/common/rendering/raycasting/raycaster.test.ts` | **Modify** — existing `castCollisionRays` tests updated to use `IBspContext`, 4 dirty-edge tests added | 6 | **DONE** |
| `src/common/rendering/raycasting/raycast-core.test.ts` | **Modify** — 1 dirty-edge passthrough test added | 6 | **DONE** |
| `src/common/geometry/bsp/dirty-edge-tracker.ts` | **Modify** — add transient partition, originals storage, restore logic | 7 | Pending |
| `src/common/store/bsp-state.ts` | **Modify** — add transient reducers, resting-state build support | 7 | Pending |
| `src/common/geometry/bsp/bsp-generation-service.ts` | **Modify** — substitute transient edges with originals before posting to worker | 7 | Pending |
| `src/renderer/components/bspStatusComponent.ts` | **Create** — `<bsp-status>` Web Component with dot + label | 9 | **DONE** |
| `src/renderer/components/index.ts` | **Modify** — import `bspStatusComponent.ts` to register the custom element | 9 | **DONE** |
| `src/renderer/index.html` | **Modify** — add `.status-bar` div with `<bsp-status>` below `.tools` | 9 | **DONE** |
| `src/css/main.css` | **Modify** — add `.status-bar` styles | 9 | **DONE** |

## Edge Cases

| Case | Handling |
|------|---------|
| **Undo/redo** | Replaces entire geometry. Must diff all edges between old and new geometry and update dirty tracker accordingly. Simpler option: mark all BSP edges stale, mark all new geometry edges dirty, rely on debounced regeneration. |
| **File load with BSP** | `loadWorld` dispatches `loadWalls(geometry)` then `setBsp(loadedBsp)` → `status: 'fresh'`. No generation needed. The middleware does not intercept `loadWalls`. |
| **File load without BSP** | `loadWorld` dispatches `loadWalls(geometry)` then `setBsp(null)` → `status: 'none'`. `BspGenerationService` sees `'none'` + polygons → spawns immediate worker. Brute-force raycaster fallback renders during the brief wait. |
| **New file (empty geometry)** | `setBsp(null)` → `status: 'none'`. No polygons → no generation triggered. Trivially empty BSP. |
| **Save** | Serialize `bspState.staleBsp` (the last fully-built tree). Dirty state is transient and not saved. |
| **Large dirty set** | Worst case: all edges dirty, spatial index covers entire world. Equivalent to brute-force — same perf as current no-BSP fallback. Debounce timer ensures regeneration starts soon. |
| **Edits during BSP generation** | Worker result carries `generationId`. Mismatched ID → result discarded. Debounce restarts. |
| **BSP split edges** | Have `material: undefined` and `immaterial: true`. Already skipped during rendering (`material == null` check). No special dirty tracking needed. |
| **Edges without IDs** | All edges going through `loadPolygon()` / `createPolygon()` get identities via `giveIdentity()`. Mutations go through `adaptPolygons` which calls `loadPolygon`, so all edges in the system have IDs. Raw `makeEdge()` doesn't assign IDs, but those aren't stored in geometry. |
| **BSP built mid-transition** | Cannot happen. The `BspGenerationService` substitutes transient edges with their stored originals before posting to the worker. The BSP always represents the resting state. |
| **Door closes after BSP rebuild** | Safe. The BSP was built from resting-state polygons (originals substituted). When `restoreTransient()` is called, transient entries are removed, and the BSP's version of those edges is correct. |
| **Transient extra geometry removed** | `transientOriginals` maps these edge IDs to `null`. On `restoreTransient()`, edges are removed from the dirty set entirely — they don't exist in the BSP or the world. |
| **completeGeneration during active transient changes** | Only the permanent partition is cleared. Transient entries survive. The new BSP was built from resting-state polygons, so transient edges remain correctly tracked. |
| **Texture/material change at runtime** | Mutate edge material in-place on BSP polygon references. No dirty tracking needed. BSP structure depends on geometry (vertex positions), not materials. |
| **Animation drift on restore** | Animations compute edge positions via transforms each tick, which may accumulate floating-point error. `restoreTransient` uses the tracker's stored originals (deep clones from `markTransientDirty`), not re-computed positions, eliminating drift. The geometry is restored to the exact pre-animation state. |
| **Animation system compatibility** | The animation system (see `docs/ANIMATION_SYSTEM_PLAN.md`) drives transient changes via the `transientWalls` slice, which calls `markTransientDirty` / `updateTransient` / `restoreTransient` on `bspState`. Animations that complete call the `restoreTransient` thunk for atomic cross-slice restore. Looping animations keep edges in the transient partition indefinitely. The BSP is never rebuilt for animation-only changes. |

## Design Decisions & Rationale

1. **Separate `bspState` slice** (not on `IGeometry`): Keeps geometry pure. BSP lifecycle (generation, staleness, dirty tracking) is an orthogonal concern from the geometry model itself.

2. **Spatial index for dirty edges** (not brute-force): Scales better when users make many edits before BSP regenerates. The index is cheap to build for small dirty sets.

3. **Web Worker for BSP generation** (not main-thread chunking): True parallelism with no frame drops. The existing `src/workers/bspGenerator.ts` already implements the worker side.

4. **Debounced trigger with cancellation**: Rapid edits (e.g., dragging a vertex) don't trigger wasted BSP builds. Only starts generation after editing pauses. In-flight generation is cancelled if new edits arrive.

5. **Immediate trigger for `needsFullBuild`**: When loading a map without BSP, the user expects the 3D view to work immediately. No reason to debounce.

6. **`generation` counter on tracker**: Cheap way for renderers to detect dirty set changes without deep comparison. Avoids unnecessary spatial index rebuilds.

7. **Two-partition dirty tracking** (permanent vs transient): Clean separation between editor changes that invalidate the BSP and game mechanics that temporarily modify geometry. Renderers don't need to know the difference — they use the combined view. Only the `BspGenerationService` cares about the distinction.

8. **Tracker stores originals for transient edges**: The tracker deep-clones the original edges when `markTransientDirty()` is called. This allows `restoreTransient()` to bring edges back to their BSP state without the game logic having to manage original state. The tracker is the single source of truth for "what does the resting world look like."

9. **BSP always represents resting state**: Before posting polygons to the worker, transient edges are substituted with their stored originals. This guarantees that when a transient change ends (e.g., door closes), the BSP is immediately correct for those edges — no rebuild needed.

10. **In-place material mutation on BSP edges**: The BSP stores direct references to polygon/edge objects. Mutating material properties (texture, color, alpha) in-place is safe because the BSP structure depends only on spatial geometry (vertex positions → splitting planes). This avoids dirty tracking overhead for purely visual changes.

11. **Transient extra geometry uses `null` originals**: When temporary geometry is spawned into the world (obstacles, entities), `transientOriginals` maps those edge IDs to `null` to indicate "this edge didn't exist in the resting state." On restore, these edges vanish from both the dirty set and the world.

12. **`restoreTransient` is a cross-slice atomic operation**: Implemented as a thunk, not a plain reducer, because it must update both `walls` (geometry) and `bspState` (dirty tracker) atomically. The thunk reads originals from the tracker and dispatches both slice updates in a single batch. This prevents rendering glitches from intermediate states and eliminates floating-point drift by using the tracker's stored originals as the authoritative resting-state edges.

13. **Three-tier status indicator (green/yellow/red)**: Yellow for stale and generating states because the system is still rendering correctly via dirty edge tracking — the BSP is degraded but functional. Red is reserved for the "no BSP" fallback state where brute-force raycasting is active and performance is impacted. This severity distinction prevents false alarm fatigue from a binary red/green indicator that would show red during every normal edit-regenerate cycle.

14. **Edge diffs via RTK listener middleware** (not `GeometryMutationResult` return types): Instead of modifying all geometry functions to return edge diffs, a `createListenerMiddleware` watches all `walls/*` actions and computes diffs by comparing geometry before and after. This keeps geometry functions pure and unchanged. Diffs are dispatched as `markDirty` actions to `bspState`. The diff uses a two-tier targeted approach: polygon-level reference equality skips unchanged polygons entirely, then vertex position comparison on changed polygons detects actual edge modifications. This replaced the original conservative approach (which treated all surviving IDs as "modified") for better performance.

15. **BSP parameter threading via `IBspContext`** (not global state reads in pure functions): Pure functions like `move()`, `strafe()`, `castCameraRay()`, and `render()` now accept an `IBspContext` (bundling `tree` + `dirtyEdges`) as an explicit parameter rather than reading from Redux. The `IBspContext` type avoids parameter proliferation — functions that need both BSP and dirty edges take a single object. Only the imperative "handler" layer (`cameraActionsHandler`, `walker`, `mapEditor`, renderers) subscribes to `state.bsp` and passes the context down. Functions that only need `bsp` (like `castCollisionRays`) take the raw `IBSPNode` parameter. This preserves function purity and testability.

16. **File load via `setBsp` + status-based auto-generation** (not `installInitialBsp`/`requestFullBuild` actions): The original plan proposed new actions and `stateLoader.ts` modifications. Analysis revealed the existing `BspGenerationService`'s `status === 'none'` handling (from Phase 4) already covered file load scenarios. The only fix needed was removing the `loadWalls → clearBsp` middleware listener that caused a race condition (unnecessary worker spawned before `setBsp(loadedBsp)` could fire). The `clearBsp` reducer was also removed as dead code. This approach is simpler, has fewer moving parts, and required no changes to `stateLoader.ts`.

## Key Codebase Context

For implementors unfamiliar with the codebase, these are the key existing files and patterns:

- **BSP build:** `src/common/geometry/bsp/creation.ts` — `buildBspTree()` is the entry point
- **BSP walk:** `src/common/geometry/bsp/querying.ts` — `walk()` and `walkWithFrustum()` traverse the tree, calling a callback with polygons at each node. Callback returns `true` to continue, `false` to stop.
- **BSP model:** `src/common/geometry/bsp/model.ts` — `LeafBspNode`, `SplitBspNode`, `NullBspNode`. BSP nodes store direct `IPolygon[]` references (not copies).
- **Store connector:** `src/common/store/store-connector.ts` — `connect()` registers callbacks on every Redux state update. Renderers use this, not React hooks.
- **Renderer switching:** `ZBufferRenderer.isActive()` returns true when BSP exists (reads `bspContext?.tree`); `Renderer3d.isActive()` returns true when BSP is absent. They are mutually exclusive. Both subscribe to `bspState` via `connect()`.
- **Edge entity IDs:** `src/common/geometry/entity.ts` — `giveIdentity()` assigns UUID strings. Edge IDs are `string | undefined`.
- **Web worker:** `src/workers/bspGenerator.ts` — listens for typed `BspWorkerRequest`, calls `buildBspTree`, posts `BspWorkerResponse` with `generationId`. Used by `BspGenerationService` for async BSP generation.
- **BSP generation service:** `src/common/geometry/bsp/bsp-generation-service.ts` — subscribes to `bspState` via `connect()`, debounces edits (500ms), posts polygons to web worker, dispatches `setBsp` on completion. Handles Ctrl+B via IPC `'bsp_generate'` for immediate generation. Replaces the deleted `BspGenerationStarter`.
- **Manual BSP trigger:** Ctrl+B menu item (`src/main/mainmenu.ts:303`) → IPC `'bsp_generate'` → `BspGenerationService` cancels debounce and generates immediately.
- **File loading:** `src/common/storage/stateLoader.ts` — `loadWorld()` dispatches `wallActions.loadWalls()`. BSP is loaded from saved state and dispatched to `bspState` via `setBsp`, with legacy compatibility for old files that stored BSP on geometry.
- **Geometry type:** `src/common/geometry/geometry.ts` — `IGeometry` no longer has a `bsp` field (removed in Phase 1). BSP lives in the `bspState` Redux slice (`state.bsp.tree`).
- **Undo skip pattern:** `src/common/store/walls.ts:64-71` — the `move` reducer uses `disableUndo` to suppress undo history for continuous game actions. Transient wall reducers (e.g., `applyTransientEdges`, `restoreEdges`) should use this same pattern since game mechanic state changes should not pollute the undo stack.
- **Animation system:** `docs/ANIMATION_SYSTEM_PLAN.md` — the companion plan for the edge animation system that drives transient geometry changes. Animations call into the `transientWalls` slice, which in turn updates `bspState` dirty tracking.
- **UI components:** `src/renderer/components/` — Web Components with Shadow DOM, registered via `customElements.define()`. All components are imported in `index.ts` `loadComponents()`. State subscriptions use `connect()` from `store-connector.ts`.
- **Editor layout:** `src/renderer/index.html` — flex column with `.views` (top 2/3, two canvases), `.tools` (bottom 1/3, four component panels). Container uses 95% height, leaving space for a status bar.
- **Global CSS:** `src/css/main.css` — dark theme (`#2d2d2d` background, `#eee` text), flexbox layout. Component-specific styles live in Shadow DOM.
