# Edge Animation System

## Problem Statement

The raycaster needs a system for animating geometry changes over time — rotating doors, sliding walls, rising platforms, etc. These animations are **transient**: they modify edge positions temporarily and then restore them to the original (resting) state. The system must integrate with the incremental BSP plan's transient dirty tracking (see `docs/INCREMENTAL_BSP_PLAN.md`) so that animations never trigger BSP regeneration.

## Goals

1. **Declarative animation definitions** — define animations as data (keyframes, durations, easing), not imperative code
2. **Redux-driven state** — animation state lives in the store for determinism, replay, and debugging
3. **Trigger system** — animations start from player interaction (use key near door), game events, or scripted sequences
4. **Transient BSP integration** — animations use `markTransientDirty` / `updateTransient` / `restoreTransient` from the BSP dirty tracker
5. **Per-edge transforms** — each animated edge has its own transform (rotation, translation, scale) applied relative to a pivot point
6. **Looping and chaining** — support looping animations (e.g., rotating fan) and sequential chains (open door → wait → close door)

## Core Concept

An **animation** is a named sequence of **keyframes** that describe how a set of edges transform over time. The **animation scheduler** ticks every frame, advancing active animations and dispatching edge position updates. When an animation completes (or is interrupted), the `restoreTransient` thunk atomically restores edges to their resting state.

```
  [Trigger]                    [Scheduler (per frame)]              [BSP Integration]
      │                               │                                    │
      ▼                               ▼                                    ▼
  startAnimation()            tick(currentTime)                  markTransientDirty()
      │                               │                          updateTransient()
      ▼                               │                          restoreTransient()
  ┌────────────┐              ┌───────────────┐                          │
  │ animations │─── reads ───►│ For each      │                          │
  │ slice      │              │ active anim:  │                          │
  │            │              │  interpolate  │── dispatches ──► transientWalls slice
  │ activeAnims│              │  keyframes    │                    + bspState slice
  │ definitions│              │  apply easing │                          │
  └────────────┘              │  compute edge │                          │
                              │  transforms   │                          │
                              └───────────────┘                          │
```

## Animation Model

### Animation Definition (stored in map file)

```typescript
interface IAnimationDefinition {
    id: string;                          // unique name, e.g., "door_1_open"
    edgeIds: string[];                   // edges affected by this animation
    pivot: Vector;                       // rotation/scale center point
    keyframes: IKeyframe[];              // ordered by time (0.0 to 1.0)
    duration: number;                    // milliseconds
    easing: EasingType;                  // "linear" | "easeInOut" | "easeIn" | "easeOut"
    loop: boolean;                       // if true, repeats indefinitely
    autoReverse: boolean;                // if true, plays forward then backward (ping-pong)
    chain?: string;                      // ID of next animation to start on completion
}

interface IKeyframe {
    t: number;                           // normalized time 0.0–1.0
    rotation?: number;                   // radians, relative to pivot
    translation?: Vector;                // [dx, dy] offset
    scale?: Vector;                      // [sx, sy] relative to pivot
}

type EasingType = "linear" | "easeInOut" | "easeIn" | "easeOut";
```

**Design notes:**
- Keyframes use normalized time (0–1), scaled by `duration` at runtime
- Transforms are relative to `pivot`, not world origin — a door rotates around its hinge
- `chain` enables sequences: "door_open" chains to "door_wait" chains to "door_close"
- `autoReverse` with `loop: false` gives "open and close" behavior in a single animation

### Active Animation State (Redux)

```typescript
interface IActiveAnimation {
    definitionId: string;                // reference to IAnimationDefinition
    startTime: number;                   // timestamp (ms) when animation started
    currentT: number;                    // current normalized time 0.0–1.0
    direction: 1 | -1;                   // 1 = forward, -1 = reverse (for autoReverse)
    paused: boolean;                     // if true, scheduler skips this animation
}
```

## Module Breakdown

### Module A1: Animation Definitions Store

**File:** `src/common/store/animations.ts`

Redux slice storing animation definitions and active animation state.

```typescript
interface IAnimationsState {
    definitions: Record<string, IAnimationDefinition>;  // keyed by animation ID
    active: Record<string, IActiveAnimation>;           // keyed by animation ID
}
```

**Reducers:**

| Reducer | Purpose |
|---------|---------|
| `loadDefinitions` | Bulk load animation definitions (from file load) |
| `addDefinition` | Add/update a single animation definition (editor) |
| `removeDefinition` | Remove an animation definition |
| `startAnimation` | Create an `IActiveAnimation` entry, dispatch initial `markTransientDirty` |
| `stopAnimation` | Remove active entry, dispatch `restoreTransient` thunk |
| `pauseAnimation` | Set `paused: true` on active entry |
| `resumeAnimation` | Set `paused: false` on active entry |
| `tickAnimation` | Update `currentT` for an active animation (called by scheduler) |
| `clearAll` | Remove all definitions and active animations (new file / file load) |

### Module A2: Animation Scheduler

**File:** `src/common/animation/animation-scheduler.ts`

Runs in the game loop (`requestAnimationFrame`). Each frame:

1. Get current timestamp
2. For each active (non-paused) animation:
   a. Compute elapsed time since `startTime`
   b. Compute normalized `t` based on `duration` and `direction`
   c. Apply easing function to get eased `t`
   d. Interpolate keyframes at eased `t` to get current transform
   e. Apply transform to each edge (relative to pivot) to get new edge positions
   f. Dispatch `updateTransient` with new edge positions
3. Handle animation completion:
   a. If `autoReverse` and direction is forward → flip direction, reset start time
   b. If `loop` → reset start time
   c. If `chain` → dispatch `stopAnimation` (current) + `startAnimation` (next)
   d. Otherwise → dispatch `stopAnimation` (triggers `restoreTransient`)

```typescript
class AnimationScheduler {
    private store: AppStore;
    private unsubscribe: (() => void) | null = null;

    constructor(store: AppStore) {
        this.store = store;
    }

    // Called from the game loop's requestAnimationFrame callback
    tick(currentTime: number): void {
        const state = this.store.getState();
        const { definitions, active } = state.animations;

        for (const [id, anim] of Object.entries(active)) {
            if (anim.paused) continue;

            const def = definitions[anim.definitionId];
            if (!def) continue;

            const elapsed = currentTime - anim.startTime;
            const rawT = Math.min(elapsed / def.duration, 1.0);
            const easedT = applyEasing(rawT, def.easing);
            const t = anim.direction === -1 ? 1.0 - easedT : easedT;

            // Interpolate keyframes
            const transform = interpolateKeyframes(def.keyframes, t);

            // Compute new edge positions
            const newEdges = applyTransformToEdges(
                getOriginalEdges(state, def.edgeIds),
                transform,
                def.pivot
            );

            this.store.dispatch(transientWallActions.updateEdges({
                edgeIds: def.edgeIds,
                edges: newEdges
            }));

            // Handle completion
            if (rawT >= 1.0) {
                this.handleCompletion(id, anim, def, currentTime);
            }
        }
    }

    private handleCompletion(
        id: string,
        anim: IActiveAnimation,
        def: IAnimationDefinition,
        currentTime: number
    ): void {
        if (def.autoReverse && anim.direction === 1) {
            this.store.dispatch(animationActions.reverseAnimation({
                id, startTime: currentTime
            }));
        } else if (def.loop) {
            this.store.dispatch(animationActions.resetAnimation({
                id, startTime: currentTime
            }));
        } else if (def.chain) {
            this.store.dispatch(stopAnimation(id));      // thunk: restores transient
            this.store.dispatch(startAnimation(def.chain)); // thunk: marks new transient
        } else {
            this.store.dispatch(stopAnimation(id));      // thunk: restores transient
        }
    }
}
```

**Design notes:**
- `getOriginalEdges` reads from `bspState.dirtyTracker.transientOriginals`, not current geometry. This ensures transforms are always applied to the **original** edge positions, preventing drift accumulation.
- The scheduler does NOT store edge state — it recomputes positions from originals + transform each tick. This is stateless and drift-free.

### Module A3: Transform & Interpolation

**File:** `src/common/animation/animation-transforms.ts`

Pure math functions for keyframe interpolation and edge transformation.

```typescript
interface ITransform {
    rotation: number;       // radians
    translation: Vector;    // [dx, dy]
    scale: Vector;          // [sx, sy]
}

// Interpolate between keyframes at normalized time t
function interpolateKeyframes(keyframes: IKeyframe[], t: number): ITransform;

// Apply transform to edge vertices relative to pivot
function applyTransformToEdges(edges: IEdge[], transform: ITransform, pivot: Vector): IEdge[];

// Apply transform to a single point relative to pivot
function transformPoint(point: Vector, transform: ITransform, pivot: Vector): Vector;

// Easing functions
function applyEasing(t: number, easing: EasingType): number;
```

**Keyframe interpolation rules:**
- For `t` between two keyframes, linearly interpolate each transform component
- For `t` before first keyframe, use first keyframe values
- For `t` after last keyframe, use last keyframe values
- Missing transform components in a keyframe default to identity (rotation=0, translation=[0,0], scale=[1,1])

### Module A4: Trigger System

**File:** `src/common/animation/animation-triggers.ts`

Defines when animations start. Triggers are evaluated by game logic, not the animation system itself.

```typescript
interface IAnimationTrigger {
    animationId: string;                 // which animation to start
    type: TriggerType;
    params: TriggerParams;
}

type TriggerType =
    | "proximity"        // player enters radius around a point
    | "interaction"      // player presses use key near a point
    | "event"            // named game event fired
    | "timer"            // fires after delay from level start
    | "chain";           // fired by another animation completing (handled internally)

interface ProximityParams {
    center: Vector;
    radius: number;
    cooldown: number;    // ms before trigger can fire again
}

interface InteractionParams {
    center: Vector;
    radius: number;
    key: string;         // input key binding
}

interface EventParams {
    eventName: string;
}

interface TimerParams {
    delay: number;       // ms from level start
}
```

**Design notes:**
- Triggers are stored alongside animation definitions in the map file
- The game loop checks trigger conditions each frame (proximity, interaction)
- `chain` triggers are handled internally by the scheduler — no external trigger evaluation needed
- Cooldown prevents rapid re-triggering (e.g., player standing near a door)

### Module A5: Transient Walls Slice

**File:** `src/common/store/transient-walls.ts`

A thin Redux slice that bridges animation edge updates with the geometry (`walls`) and BSP dirty tracker (`bspState`) slices.

```typescript
interface ITransientWallsState {
    activeEdgeIds: ReadonlySet<string>;  // all edge IDs currently in transient animation
}
```

**Reducers / Thunks:**

| Action | Purpose |
|--------|---------|
| `applyTransientEdges` (thunk) | Called when animation starts. Reads original edges from geometry, dispatches `markTransientDirty` on `bspState`, updates geometry with initial transformed positions. Uses `disableUndo` pattern. |
| `updateEdges` (thunk) | Called each tick. Dispatches `updateTransient` on `bspState` with new edge positions. Updates geometry. Uses `disableUndo` pattern. |
| `restoreEdges` (thunk) | Called when animation ends. Dispatches the `restoreTransient` cross-slice thunk (see BSP plan) which atomically restores geometry and clears tracker entries. |

All thunks use the `disableUndo` pattern from `walls.ts:64-71` to prevent animation state from polluting the undo stack.

### Module A6: Storage Format

**File:** `src/common/storage/stateLoader.ts` (modified)

Animation definitions and triggers are stored in the map JSON file alongside geometry:

```json
{
    "geometry": { ... },
    "bsp": { ... },
    "animations": {
        "definitions": {
            "door_1_open": {
                "edgeIds": ["edge-42", "edge-43"],
                "pivot": [100, 200],
                "keyframes": [
                    { "t": 0.0, "rotation": 0 },
                    { "t": 1.0, "rotation": 1.5708 }
                ],
                "duration": 500,
                "easing": "easeInOut",
                "loop": false,
                "autoReverse": true
            }
        },
        "triggers": [
            {
                "animationId": "door_1_open",
                "type": "interaction",
                "params": { "center": [100, 200], "radius": 50, "key": "e" }
            }
        ]
    }
}
```

**Load behavior:**
- `loadWorld()` dispatches `animationActions.loadDefinitions(file.animations.definitions)`
- `loadWorld()` dispatches trigger registration
- Active animations are NOT saved — they are transient runtime state
- On save: serialize `animations.definitions` and `animations.triggers` from store

### Module A7: Editor Integration

**File:** `src/renderer/components/` (new panel or existing properties panel)

Future editor UI for creating/editing animations. Not part of the initial implementation, but the data model supports it:

- Select edges → create animation definition
- Set pivot point (click on map)
- Add keyframes with transform values
- Preview animation in editor (play/pause/scrub)
- Assign triggers

## Phased Implementation Plan

| Phase | What | System Behavior |
|-------|------|-----------------|
| **A1** | Animation model types + `animations` slice (definitions + active state) + storage format | Definitions can be loaded/saved in map files. No runtime behavior yet. |
| **A2** | Transform & interpolation module (pure math) | Keyframe interpolation and edge transforms testable in isolation. |
| **A3** | `transientWalls` slice + integration with `bspState` dirty tracking | Bridge between animation system and BSP transient tracking. Requires BSP plan Phase 7. |
| **A4** | Animation scheduler + game loop integration | Animations play at runtime. Edges move. BSP stays correct via transient tracking. |
| **A5** | Trigger system (proximity, interaction, event, timer) | Animations start from game events. |
| **A6** | Chaining and looping | Complex animation sequences work. |
| **A7** | Editor UI for animation authoring | Users can create animations visually. |

**Dependency:** Phases A3+ require BSP plan Phase 7 (transient partition) to be implemented first.

## Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `src/common/animation/animation-model.ts` | **Create** — type definitions for `IAnimationDefinition`, `IKeyframe`, `IActiveAnimation`, `ITransform`, `EasingType` | A1 |
| `src/common/store/animations.ts` | **Create** — Redux slice for animation definitions and active state | A1 |
| `src/common/store/index.ts` | **Modify** — add `animations` slice to root store | A1 |
| `src/common/storage/stateLoader.ts` | **Modify** — load/save animation definitions and triggers | A1 |
| `src/common/animation/animation-transforms.ts` | **Create** — keyframe interpolation, easing, edge transform math | A2 |
| `src/common/store/transient-walls.ts` | **Create** — thunks bridging animations to geometry + BSP dirty tracking | A3 |
| `src/common/store/walls.ts` | **Modify** — add `restoreEdges` and `applyTransientEdges` reducers (with `disableUndo`) | A3 |
| `src/common/store/bsp-state.ts` | **Modify** — ensure transient thunks work with animation-driven calls | A3 |
| `src/common/animation/animation-scheduler.ts` | **Create** — frame-by-frame animation tick logic | A4 |
| `src/renderer/renderer.ts` | **Modify** — call `scheduler.tick(timestamp)` in game loop | A4 |
| `src/common/animation/animation-triggers.ts` | **Create** — trigger types, evaluation logic | A5 |
| `src/renderer/renderer.ts` | **Modify** — evaluate triggers each frame | A5 |

## Edge Cases

| Case | Handling |
|------|---------|
| **Animation started on edge that's already transient** | Reject. An edge can only be in one active animation at a time. `startAnimation` checks `activeEdgeIds` and throws if overlap. |
| **Editor modifies edge that's currently animating** | Stop the animation first (restore to resting state), then apply editor change as permanent. The animation definition may become invalid — flag it for user review. |
| **File load while animations are active** | `clearAll` stops all animations. `loadWorld` re-initializes from file. No transient state survives a file load. |
| **Animation definition references deleted edges** | Validation on play: if any `edgeIds` in the definition don't exist in current geometry, the animation is skipped with a console warning. |
| **Very fast animations (< 1 frame)** | The scheduler computes `rawT = min(elapsed / duration, 1.0)`. If duration is shorter than a frame, `rawT` immediately reaches 1.0 and completion handling fires on the first tick. The edge still goes through the full markTransient → updateTransient → restoreTransient cycle. |
| **Multiple animations active simultaneously** | Each animation operates on independent edge sets (enforced by `activeEdgeIds` overlap check). The scheduler processes all active animations each tick. The transient dirty tracker handles multiple sets of transient edges. |
| **Paused animation during BSP rebuild** | Paused animations keep edges in the transient partition. `BspGenerationService` substitutes them with originals when building. Safe — paused edges just don't move. |
| **Game saves during active animation** | Active animations are not saved. On next load, all edges start at resting state (which is what the BSP represents). Animation triggers will re-activate them when conditions are met. |
| **Looping animation and BSP rebuild** | Looping animations never call `restoreTransient`, so their edges stay in the transient partition indefinitely. `BspGenerationService` substitutes with originals for BSP builds. This is by design — the BSP always represents resting state. |
| **Chain target animation doesn't exist** | `startAnimation` checks definition exists. If chain target is missing, the current animation stops normally (restoreTransient) and a console warning is emitted. |
| **Floating-point drift from repeated transforms** | The scheduler always computes transforms from the **original** edge positions (stored in `transientOriginals` in the BSP dirty tracker), never from the current position. This means transforms are applied fresh each tick, preventing drift accumulation. |

## Design Decisions & Rationale

1. **Declarative keyframe model** (not imperative callbacks): Keyframe data is serializable, editable in a future GUI, and can be stored in map files. Imperative animation code would be harder to author, debug, and save.

2. **Transforms from originals each tick** (not incremental deltas): Prevents floating-point drift. Each tick computes the full transform from the original edge positions, not from the previous frame's positions. Slightly more computation per tick, but guarantees correctness.

3. **Scheduler in game loop** (not `setInterval`): Ties animation timing to frame rendering. Ensures animations update exactly once per rendered frame. No desync between animation state and what's displayed.

4. **Separate `transientWalls` slice** (not in `walls` or `animations`): Clean separation of concerns. `animations` owns definitions and playback state. `transientWalls` owns the bridge to geometry + BSP. `walls` owns the geometry. Each slice has a single responsibility.

5. **`disableUndo` for all transient operations**: Animation-driven geometry changes are ephemeral game state, not user edits. They should never appear in the undo history. The existing `disableUndo` pattern in `walls.ts:64-71` provides a proven mechanism.

6. **Overlap rejection** (not blending): Two animations cannot affect the same edge simultaneously. This avoids complex transform blending and keeps the system simple. If blending is needed later, it can be added as an explicit blend mode.

7. **Active state not saved to file**: Animations are transient runtime phenomena. Saving mid-animation state would require complex restore logic. Instead, the resting state is always saved, and triggers re-activate animations naturally on load.

8. **Pivot point per animation** (not per edge): A single pivot point per animation keeps the common case simple (door hinges on one point, platform rises from center). Per-edge pivots can be added later if needed by allowing keyframes to specify edge-specific transforms.

9. **Easing at animation level** (not per keyframe): Keeps the model simple. For complex easing curves, use more keyframes with linear easing. Per-keyframe easing can be added later if the simple model proves insufficient.

10. **Chain-based sequences** (not a separate "sequence" concept): Chaining reuses the existing animation machinery. Each step in a sequence is just an animation with a `chain` pointer. This avoids a second orchestration layer and keeps the mental model flat.

## Key Codebase Context

For implementors unfamiliar with the codebase:

- **Game loop:** `src/renderer/renderer.ts` — uses `requestAnimationFrame`. The scheduler's `tick()` should be called here before rendering.
- **Store connector:** `src/common/store/store-connector.ts` — `connect()` for non-React state subscriptions. The scheduler reads directly from `store.getState()` rather than subscribing.
- **Transient BSP tracking:** `docs/INCREMENTAL_BSP_PLAN.md` Module 3 (`bspState` slice) + cross-slice `restoreTransient` thunk — the animation system's primary integration point.
- **Undo skip pattern:** `src/common/store/walls.ts:64-71` — `disableUndo` flag pattern for actions that should not enter undo history.
- **Edge identity:** `src/common/geometry/entity.ts` — `giveIdentity()` assigns UUID strings. Animation definitions reference edges by these IDs.
- **Vector math:** `src/common/math.ts` — `rotate`, `add`, `subtract`, `scale` for 2D vector operations. The transform module should use these.
- **Edge creation:** `src/common/geometry/edge.ts` — `loadEdge()` computes derived properties (`length`, `slope`, `luminosity`). Transformed edges must go through `loadEdge` to recompute derived fields.
- **Material cloning:** `src/common/geometry/properties.ts` — `cloneMaterial()` for deep-copying materials when creating transformed edge copies.
