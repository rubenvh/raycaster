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

## Key Files

- `src/common/geometry/bsp/querying.ts` - BSP tree traversal (`walk()`, `intersectRay()`)
- `src/common/geometry/bsp/splitting.ts` - Polygon splitting logic
- `src/common/geometry/bsp/model.ts` - BSP node type definitions
- `src/common/rendering/zbuffering/zbuffer-renderer.ts` - Main renderer
- `src/common/camera.ts` - Camera model and clipping
- `src/common/geometry/edge.ts` - Edge model and utilities
- `src/common/geometry/polygon.ts` - Polygon model
