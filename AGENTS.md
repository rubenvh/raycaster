# Raycaster Project

Electron-based desktop application with a 2D geometry editor and 3D raycasting engine (Wolfenstein 3D/Doom style).

## Project Structure

- `src/common/` - Shared code (geometry, math, rendering, camera, store)
- `src/main/` - Electron main process
- `src/renderer/` - Electron renderer process (UI components)
- `assets/maps/` - JSON map files
- `docs/` - Documentation

## Geometry Model

### Edges (`IEdge`)

Edges are line segments with start/end vertices. Key properties:

- `material`: Defines color, texture, and alpha (transparency)
- `immaterial`: Boolean flag meaning **passable but visible** (e.g., waterfall, fog effect)
  - `immaterial: true` → no collision, **still renders**
  - `immaterial: false` or `undefined` → solid wall with collision
- `segment`: The actual `[start, end]` line segment coordinates
- `luminosity`: Brightness based on wall angle (vertical walls brighter than horizontal)

**Important:** `immaterial` does NOT mean "don't render" - it means "don't collide".

### Polygons (`IPolygon`)

- Collection of edges forming a closed shape
- Contains vertices and bounding box
- Can be convex or non-convex (BSP handles splitting non-convex)

## BSP Tree Model

### Node Types

- `LeafNode`: Contains array of polygons, no further splitting
- `SplitNode`: Has a splitting plane and three child references:
  - `front`: Polygons in front of the plane
  - `back`: Polygons behind the plane
  - `coplanar`: Polygons lying on the splitting plane
- `NullBspNode`: Empty node

### Critical Insight: BSP Walk Order ≠ Distance Order

```
Camera at C looking right:

    [E1]----[E2]     <- coplanar edges at DIFFERENT distances
         \  /
          \/
          C (camera)
```

- BSP walk visits nodes in front-to-back **spatial** order relative to splitting planes
- **Coplanar edges can be at ANY distance** from the camera
- You CANNOT use BSP traversal order for early termination based on "closest first"
- The ZBuffer must sort all edges by actual distance for correct rendering

### Split Edges

When polygons are split by a plane, new edges are created to close the resulting sub-polygons:
- Created with `immaterial: true` and `material: undefined`
- They exist to maintain polygon integrity but shouldn't render as visible walls
- Location: `src/common/geometry/bsp/splitting.ts` - `createSplitEdge()`

## Rendering Pipeline (ZBuffer Renderer)

Location: `src/common/rendering/zbuffering/zbuffer-renderer.ts`

### Process

1. Walk BSP tree from camera position
2. For each polygon's edges:
   - Skip if `material == null` (no material to render)
   - Skip if clipped entirely outside camera view
   - Add visible edges to ZBuffer
3. ZBuffer sorts by distance using priority queue
4. Render columns front-to-back, handling transparency

### Key Rendering Checks

```typescript
// Skip edges with no material (split edges, etc.)
if (e.material == null) continue;

// Clip to camera frustum
const clipped = clip(e, camera);
if (clipped === NULL_EDGE) continue;
```

### DO NOT Skip Based On

- `immaterial` flag - those edges should render, just don't block movement
- `buffer.isFull()` during BSP walk - coplanar edges break the "front-to-back" assumption

## Camera & View Frustum

Location: `src/common/camera.ts`

### Camera Structure

- `position`: Camera location in world space
- `direction`: Forward vector
- `plane`: Perpendicular vector defining FOV width
- `screen`: Line segment representing the projection screen
- `cone`: Left and right rays defining view frustum
- `planes`: Three planes for frustum culling (camera plane, left, right)

### Clipping

- Edges are clipped to the view frustum before rendering
- Uses `classifyPointToPlane` to determine if points are in front/behind planes
- Edges completely outside view return `NULL_EDGE`

## Material System

### `IDirectedMaterial`

- Can be a single material or `[front, back]` tuple for double-sided edges
- Each material has:
  - `color`: RGBA array `[r, g, b, alpha]`
  - `texture`: Optional texture reference with id and index

### Transparency

- Alpha channel (`color[3]`) controls transparency
- `alpha === 1` = fully opaque
- `alpha === 0` = invisible (but edge still exists)
- `0 < alpha < 1` = translucent

## Common Pitfalls

1. **Assuming BSP order = distance order** - It's not! Coplanar nodes break this assumption.

2. **Treating `immaterial` as "don't render"** - It means "don't collide", not "don't draw". Immaterial edges like waterfalls should still be visible.

3. **Confusing `material == null` with `immaterial: true`** - Very different meanings:
   - `material == null`: No visual representation, skip rendering
   - `immaterial: true`: Has visual representation, but no collision

4. **Split edges from BSP** - Have both `immaterial: true` AND `material: undefined`. They correctly don't render because `material == null`.

5. **Early termination in BSP walk** - Cannot terminate early based on "buffer is full" because coplanar edges may be closer than already-processed edges.

## Non-Obvious Behaviors & Gotchas

### Math Module

1. **`perpendicular()` produces negative zero**: `perpendicular([1, 0])` returns `[-0, 1]`. JavaScript's `===` treats `-0 === 0` as true, but `Object.is(-0, 0)` is false. Jest's `toEqual` uses `Object.is`, so `expect(perpendicular([1,0])).toEqual([0,1])` fails. Use `toBeCloseTo` for each component, or accept `-0` in expected values.

2. **`intersectRaySegment` uses scratch vectors**: The collision module uses module-level mutable scratch vectors (`_v1`, `_v2`, `_point`, `_planePoint`) for performance. The intersection point is copied to a new array before return, so callers get safe values. But this means the function is NOT safe to call concurrently from multiple threads (irrelevant in single-threaded JS, but worth knowing).

3. **In-place vector operations**: `subtractInto`, `addInto`, `scaleInto` mutate the first `out` parameter. These exist for hot-path performance in rendering loops and should not be used in general code.

### Entity & Identity System

4. **`IEntity.id` is `string | undefined`**: Entity IDs are optional — `giveIdentity()` only assigns an ID if one doesn't exist. This means many factory-built objects will have IDs but raw `makeEdge()`/`makeVertex()` calls won't. When comparing entities, don't assume `id` is always present.

5. **`createEntityKey()` uses `Guid.create().toString()`**: Entity keys are UUID strings. They are globally unique but non-deterministic, so tests comparing entity IDs should use identity checks (`===`) on the same object, not value equality on the string.

### Material System

6. **`cloneMaterial` adds `texture` and `luminosity` as explicit properties**: Even when the source material has no `texture` or `luminosity` fields, `cloneSingleMaterial` copies them, resulting in `{ color: [...], texture: null, luminosity: undefined }`. This means a cloned material won't `toEqual` the original if the original didn't have those fields. Deep equality checks in tests need to account for these extra properties.

7. **`cloneMaterial(null)` returns `null`**: The function handles null input gracefully. `cloneMaterial(undefined)` also returns `null` (not `undefined`) because the `m == null` check catches both.

8. **`getMaterial` returns `null` for undefined material**: `getMaterial(face, undefined)` returns `null`, not `undefined`. This propagates to `lookupMaterialFor(intersection, edge)` which also returns `null` when the edge or material is missing.

9. **`isTranslucent` treats missing alpha as 0**: The expression `(getMaterial(face, m)?.color[3] || 0) < 1` means materials with `color[3] === 0` (invisible) are treated as translucent, and missing materials are treated as translucent.

### Edge Model

10. **`loadEdge` computes derived properties**: When loading or creating edges, `loadEdge` calculates `length`, `slope`, `segment`, and `luminosity` from the start/end vertices. If you mutate vertex positions after edge creation, these derived values become stale.

11. **`luminosity` is slope-dependent**: Horizontal edges (slope=0) get luminosity 0.4 (darkest), vertical edges (slope=Infinity) get 1.0 (brightest). This simulates directional lighting. The formula is `0.4 + (|slope| / (1 + |slope|)) * 0.6`.

12. **`NULL_EDGE` is a singleton**: `NULL_EDGE = makeEdge([0,0], [0,0])`. Clipping returns this exact reference when an edge is outside the frustum. Code checks `clipped === NULL_EDGE` (reference equality), not value equality.

### Geometry Model

13. **`createGeometry` assigns default material**: Edges created via `createEdges()` get a default translucent red material `[255, 20, 20, 0.2]` and `immaterial: false`. This is the material used when creating polygons from raw vertex arrays.

14. **`addPolygon` increments `edgeCount` by 1, not by polygon's edge count**: This appears to be a bug — `addPolygon` does `geometry.edgeCount + 1` instead of `geometry.edgeCount + p.edgeCount`. The correct edge count is only computed by `countEdges` during `createGeometry`/`loadGeometry`/`adaptPolygons`.

15. **Geometry operations clear BSP**: Most mutation functions (`adaptPolygons`, `forkPolygons`) set `bsp: null` on the returned geometry. The BSP tree must be explicitly rebuilt after geometry changes.

16. **`EMPTY_GEOMETRY` has no ID**: It's just `{polygons: [], edgeCount: 0, bounds: [0,0]}`. Some code paths check `geometry.bsp` which will be `undefined` (falsy) on empty geometry.

### Camera Model

17. **Camera `direction` and `plane` are NOT unit vectors**: The default camera has `direction: [0, 10]` and `plane: [15, 0]`. The magnitude of `direction` controls view depth, and the magnitude of `plane` controls FOV width. `adaptAngle` scales the plane by 5% increments; `adaptDepth` scales the direction by 1% increments.

18. **`makeCamera` derives several computed properties**: `screen`, `midline`, `cone`, and `planes` are all computed from `position`, `direction`, and `plane`. Calling `makeCamera` with different data creates a fully consistent camera. Never construct an `ICamera` manually without `makeCamera`.

19. **`move` and `strafe` have wall-sliding logic**: When the camera is close to a wall (distance < 2), movement slides along the wall if the collision angle is large enough (> PI/8). If the angle is too shallow, movement stops entirely. This uses recursive `constrainedMove` which could theoretically cause stack overflow (noted with TODO in code).

20. **`clip` uses reference equality**: `clip` returns `NULL_EDGE` (the singleton) when an edge is completely outside the camera frustum. The caller checks `clipped === NULL_EDGE`.

### Collision System

21. **`intersectRayEdge` returns a non-null result even on miss**: When a ray doesn't intersect an edge, it returns `{polygon: null, ray, edge, intersection: null, distance: 0}` — NOT `null`. It only returns `null` when the edge is filtered out by `options.edgeFilter`. This distinction matters: a miss still has an entry, but with `intersection: null`.

22. **`hasIntersect` is an optimization gate**: The bounding box check `hasIntersect(ray, box)` is only applied to polygons with more than 5 edges (`polygon.edgeCount > 5`). Small polygons skip this check and test every edge directly.

### BSP Tree

23. **`walk()` returns boolean for continuation**: The callback passed to `walk()` should return `true` to continue traversal, `false` to stop. The walk visits front subtree, then coplanar, then back subtree (relative to camera position). Despite this ordering, distance ordering is NOT guaranteed for coplanar edges.

### Store & Redux

24. **`useAppDispatch` is NOT a React hook**: Despite its name, `useAppDispatch` in `src/common/store/index.ts` is just `() => store.dispatch` — a plain function that returns the dispatch function. It doesn't use React.

25. **`connect` is NOT Redux's connect**: The `connect` function in `store-connector.ts` is a custom subscription mechanism that registers callbacks to be called on every store update. It returns an unsubscribe function. It's used by renderer classes and `WallPainter` to receive state updates.

26. **Redux logger filters player and stats actions**: The redux-logger middleware is configured to skip logging actions that start with `'stats'` or `'player'` to reduce console noise during gameplay.

27. **Serializable check is disabled**: The Redux store uses `serializableCheck: false` because geometry objects (with Sets, complex nested structures) are not serializable.

### Rendering Pipeline

28. **Two independent rendering paths exist**: 
    - **Raycaster** (`raycaster.ts`): Casts one ray per screen column through BSP or brute-force polygon intersection. Used for traditional Wolfenstein-style rendering.
    - **ZBuffer** (`zbuffer-renderer.ts`): Walks BSP tree, clips edges to frustum, projects to screen columns, uses priority queue per column for distance sorting. More efficient for complex scenes.

29. **`castCameraRay` vs `castCollisionRays` have different filter logic**: `castCameraRay` filters out `immaterial` edges (used for movement collision). `castCollisionRays` filters out edges with no material (used for rendering). This is the key distinction between movement and visibility.

30. **`needsRendering` checks both intersection and material**: A ray hit only needs rendering if `lookupMaterialFor(hit.intersection, hit.edge)` returns a truthy material. Hits with `null` intersection or `null` material are filtered out in `filterAndSortHits`.

31. **`filterAndSortHits` uses insertion sort**: Instead of `filter().sort()`, it does a single pass with binary search insertion. This is a performance optimization for the hot rendering path.

32. **ZBuffer uses `PriorityDeque` (external library)**: Each `ZBufferColumn` uses `priority-deque` for distance-sorted wall storage. The old `Heap` implementation is commented out but still in the code.

33. **`ZBufferColumn.isFull` tracks opaque walls**: A column is "full" when it contains at least one opaque wall (`alpha === 1`). This is a fast check to skip adding more walls behind an opaque one, but it doesn't prevent the BSP walk from continuing.

### Testing Infrastructure

34. **Fishery factories with `afterBuild` and `Object.assign`**: The camera and geometry factories use `afterBuild` hooks that call `Object.assign(object, newObject)` to replace all properties. This works because `makeCamera`/`createGeometry` return fresh objects with all computed fields.

35. **`resetTestRandom` should be called in `beforeEach`**: The shared `testRandom` instance maintains state across tests. Without resetting, test order affects random values. Always call `resetTestRandom()` in `beforeEach` for deterministic tests.

36. **Factory `sequence` starts at 1**: Fishery's `sequence` parameter in factory definitions starts at 1 and auto-increments. Useful for generating unique IDs like `edge-1`, `edge-2`, etc.

## Key Files

- `src/common/geometry/bsp/querying.ts` - BSP tree traversal (`walk()`, `intersectRay()`)
- `src/common/geometry/bsp/splitting.ts` - Polygon splitting logic
- `src/common/geometry/bsp/model.ts` - BSP node type definitions
- `src/common/rendering/zbuffering/zbuffer-renderer.ts` - Main renderer
- `src/common/rendering/raycasting/raycaster.ts` - Raycasting renderer
- `src/common/rendering/raycasting/raycast-core.ts` - Pure raycast core (no DOM/Redux)
- `src/common/rendering/zbuffering/zbuffer-core.ts` - Pure zbuffer core (no DOM/Redux)
- `src/common/camera.ts` - Camera model and clipping
- `src/common/geometry/edge.ts` - Edge model and utilities
- `src/common/geometry/polygon.ts` - Polygon model
- `src/common/geometry/collision.ts` - Ray-segment/polygon intersection
- `src/common/geometry/properties.ts` - Material, Face, cloneMaterial
- `src/common/geometry/entity.ts` - Entity identity system (GUIDs)
- `src/common/store/index.ts` - Redux store configuration
- `src/common/store/store-connector.ts` - Custom subscription connector
- `src/common/testing/seeded-random.ts` - Deterministic random for tests
- `src/common/testing/factories/` - Fishery test data factories
