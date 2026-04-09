# Polygon Height Properties: Impact Analysis

## Overview

This document analyzes the addition of two height properties to polygons -- **floor height** and **ceiling height** -- transforming the engine from a flat Wolfenstein 3D-style raycaster into a Doom-style 2.5D engine with variable elevation.

### Proposed Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `floorHeight` | `number` | `0` | Elevation of the polygon's floor surface. Negative = below sea level, positive = raised platform. |
| `ceilingHeight` | `number` | `10` | Elevation of the polygon's ceiling. Controls how high walls extend. |

### What This Enables

- Platforms, stairs, and pits (variable floor elevation)
- Low walls the player can look over
- Doorways and windows (openings between sectors with different heights)
- Gravity -- player falls when stepping off a ledge
- Step-up / step-down movement (small height changes are walkable)
- Tunnels and enclosed spaces (low ceilings)

---

## Current State: A Flat World

The engine is a purely 2D raycaster. No Z-axis exists anywhere in the codebase.

### Key Facts

- `Vector = [number, number]` -- 2D only (`src/common/math/vector.ts:1`)
- `IPolygon` has no height properties (`src/common/geometry/polygon.ts:8`)
- `ICamera` has no vertical position, pitch, or eye height (`src/common/camera.ts:12-19`)
- Wall height is a hardcoded constant in the projection formula (`src/common/drawing/wall-painter.ts:88`):
  ```typescript
  convertDistanceToWallHeight = (d: number) => Math.round(10 * this.height / d);
  ```
- Walls are always vertically centered on the horizon line (screen midpoint)
- Sky fills the top half of the screen, floor fills the bottom half -- no variation
- There is no gravity, no Z-velocity, no vertical movement of any kind

### Current Rendering Pipeline (Simplified)

```
BSP walk -> collect edges -> clip to frustum -> project to screen columns
  -> sort by distance per column -> draw back-to-front as trapezoids
```

Each edge produces exactly **one wall** per column, always spanning from `(screenHeight - wallHeight) / 2` to `(screenHeight + wallHeight) / 2`. The `10` in the formula represents the fixed world-space wall height.

---

## Architectural Models: Two Options

### Option A: Absolute Wall Height (Simple)

Each polygon gets `floorHeight` and `wallHeight`. Edges always render at their owning polygon's height. No neighbor awareness.

```
Polygon A: floorHeight=0, wallHeight=10     Polygon B: floorHeight=3, wallHeight=10

        ┌─────────┐  ┌─────────┐
   10   │    A    │  │    B    │  13
        │         │  │         │
    0   └─────────┘  └─────────┘   3
```

- Each polygon's walls draw independently from `floorHeight` to `floorHeight + wallHeight`
- Shared edges between adjacent polygons render **twice** (once per polygon)
- No doorways, windows, or smooth transitions between floor heights
- Looking over walls works: short `wallHeight` means the wall doesn't fill the screen

**Pros:** Simple model, no neighbor-tracking, easy to implement.
**Cons:** No doorways or windows. Shared edges produce ugly double-rendering. Can't see through openings between sectors.

### Option B: Doom-Style Sectors (Expressive)

Each polygon becomes a **sector** with `floorHeight` and `ceilingHeight`. Shared edges render the **height differences** between adjacent polygons.

```
Sector A: floor=0, ceiling=10          Sector B: floor=3, ceiling=8

   ┌────────────────────────────────────────────────────────┐
10 │              A ceiling                                 │ 10
   │                          ┌─────────────────────────────┤  8
   │                          │        B ceiling            │
   │                          │                             │
   │         A floor          │        B floor              │
   ├──────────────────────────┤                             │  3
 0 │       lower wall         │                             │
   └──────────────────────────┘─────────────────────────────┘  0
                              ^
                        shared edge renders:
                        - lower wall from 0 to 3 (step face)
                        - upper wall from 8 to 10 (ceiling step)
                        - opening from 3 to 8 (passable, visible through)
```

**Pros:** Doorways, windows, stairs, platforms, tunnels, varying ceiling heights. Industry-proven (Doom, Duke3D, Build engine).
**Cons:** Significantly more complex -- requires neighbor-tracking, multi-part wall rendering, portal-based see-through logic.

### Recommendation

**Option B (Doom-style sectors)** is the clear winner for long-term expressiveness. However, it can be implemented incrementally:

1. **Phase 1:** Add `floorHeight` and `ceilingHeight` to polygons. Render exterior edges (no back sector) using absolute heights. No neighbor awareness yet.
2. **Phase 2:** Add edge-to-polygon neighbor tracking. Render shared edges as height-difference walls with openings.
3. **Phase 3:** Add portal rendering (seeing through openings into adjacent sectors).
4. **Phase 4:** Add textured floors/ceilings (visplanes).

The rest of this analysis assumes Option B as the target architecture.

---

## Impact Analysis by System

### 1. Geometry Model

**Files affected:**
- `src/common/geometry/polygon.ts` -- `IPolygon`, `IStoredPolygon`
- `src/common/geometry/edge.ts` -- `IEdge` (potentially)
- `src/common/geometry/geometry.ts` -- `IGeometry`, creation/mutation functions
- `src/common/storage/` -- serialization

#### 1.1 Polygon Interface Changes

```typescript
// polygon.ts -- IPolygon gains height properties
export type IPolygon = IEntity & {
    edges: IEdge[],
    vertices: IVertex[],
    boundingBox: BoundingBox,
    edgeCount: number,
    floorHeight: number,      // NEW: elevation of floor surface
    ceilingHeight: number,    // NEW: elevation of ceiling surface
};

// IStoredPolygon gains serializable height fields
export type IStoredPolygon = IEntity & {
    edges: IStoredEdge[],
    floorHeight?: number,     // NEW: optional for backward compat (default 0)
    ceilingHeight?: number,   // NEW: optional for backward compat (default 10)
};
```

#### 1.2 Neighbor Tracking (New System)

Currently, edges have no knowledge of which polygon(s) they belong to. For sector-style rendering, when a ray hits an edge, the renderer needs to know:
1. Which polygon is on the **front** side of this edge?
2. Which polygon is on the **back** side?
3. What are their respective `floorHeight` / `ceilingHeight`?

**Approach: Edge-to-Sector Lookup Map**

```typescript
// New type: maps an edge ID to the sectors on each side
type SectorPair = {
    front: IPolygon | null,   // polygon on the front face
    back: IPolygon | null,    // polygon on the back face
};

type EdgeSectorMap = Map<IEntityKey, SectorPair>;
```

This map would be built at geometry load time by iterating all polygons and their edges. Shared edges (edges belonging to two different polygons) get both `front` and `back` set. Boundary edges (belonging to one polygon only) have one side as `null`.

**Edge identity matching:** Two edges from different polygons are "shared" if they connect the same vertices (in opposite winding order). This requires comparing vertex positions or IDs. The `IEntity.id` on edges can be used if edges are cloned correctly during polygon creation, but the more robust approach is spatial matching: two edges share endpoints if `edge1.start ≈ edge2.end` and `edge1.end ≈ edge2.start` (reversed winding).

**When to rebuild:** The edge-sector map must be rebuilt whenever geometry changes (similar to how BSP is rebuilt). It can be computed alongside the BSP build since it requires a full geometry pass.

#### 1.3 Impact on Polygon Mutation Functions

All mutation functions in `src/common/geometry/geometry.ts` that create or modify polygons must preserve height properties:

| Function | Location | Change Needed |
|---|---|---|
| `createPolygon` | `polygon.ts:55` | Accept optional `floorHeight`/`ceilingHeight` params, default to 0/10 |
| `loadPolygon` | `polygon.ts:15` | Read height from `IStoredPolygon`, default if missing |
| `addPolygon` | `geometry.ts:25` | Pass through height properties |
| `splitPolygon` | `geometry.ts:255` | Both halves inherit parent's heights |
| `duplicatePolygons` | `geometry.ts:129` | Copied polygons inherit heights |
| `mergePolygons` | `geometry.ts:710` | Merged polygon gets... which height? Needs a policy (e.g., average, or require same height) |
| `adaptPolygons` / `forkPolygons` | `geometry.ts` (internal) | Must carry height through clone/rebuild |

**Key concern:** `mergePolygons` is ambiguous when merging polygons with different heights. Options: disallow merging different-height polygons, use the first polygon's height, or average them. Disallowing is safest.

#### 1.4 Impact on BSP Splitting

**File:** `src/common/geometry/bsp/splitting.ts`

When BSP splits a polygon across a plane, the two resulting sub-polygons must inherit the original's heights:

```typescript
// In splitPolygon (splitting.ts:46), after creating front/back polygons:
frontPolygon.floorHeight = original.floorHeight;
frontPolygon.ceilingHeight = original.ceilingHeight;
backPolygon.floorHeight = original.floorHeight;
backPolygon.ceilingHeight = original.ceilingHeight;
```

This is straightforward since `splitPolygon` already clones edge properties. The height fields just need to be included in the polygon construction.

**Split edges** (created by `createSplitEdge` at `splitting.ts:97`) already have `immaterial: true` and `material: undefined`. They won't render walls but they **do** become internal boundaries within the same sector. The neighbor map must treat split edges as internal (both sides belong to sub-polygons of the same original sector, same heights).

**BSP node bounds remain 2D:** The BSP tree partitions 2D space. Height doesn't affect BSP structure -- it's purely a rendering/collision attribute. No changes needed to the BSP traversal algorithm itself (`walk`, `walkWithFrustum` in `querying.ts`).

---

### 2. Camera and Player Model

**File:** `src/common/camera.ts`, `src/common/store/player.ts`

#### 2.1 New Camera Properties

```typescript
// camera.ts -- ICameraData gains vertical state
type ICameraData = {
    position: Vector,       // XY position (unchanged)
    direction: Vector,      // forward vector (unchanged)
    plane?: Vector,         // FOV plane (unchanged)
    zPosition: number,      // NEW: Z coordinate of player's feet
    eyeHeight: number,      // NEW: height of eyes above feet (e.g., 6)
    zVelocity: number,      // NEW: vertical velocity for gravity
};
```

The projection reference point is `zPosition + eyeHeight`. This is the world-space height from which all vertical screen positions are computed.

#### 2.2 Player State Changes

```typescript
// player.ts -- IPlayerState
export type IPlayerState = {
    camera: ICamera,
    // zPosition, eyeHeight, zVelocity live inside ICamera
    // OR could be separate fields if we want to decouple vertical
    // state from the camera's horizontal projection concerns
};
```

**Design choice:** Embedding Z-state in the camera keeps `makeCamera` as the single source of truth. But `makeCamera` currently computes only 2D-derived fields (screen, cone, planes). Adding Z-state means `makeCamera` must accept and pass through Z fields without using them for 2D computation. This is acceptable since `makeCamera` already passes through `position`, `direction`, and `plane` as-is.

#### 2.3 Default Values

```typescript
export const DEFAULT_EYE_HEIGHT = 6;    // player eye level in world units
export const DEFAULT_PLAYER_HEIGHT = 7;  // total player height for collision
export const MAX_STEP_HEIGHT = 2.5;      // max height diff player can step up
```

The wall scale constant `10` in the current formula corresponds to a full wall height of 10 world units. With the default `eyeHeight` of 6, the player's eyes are at 60% of a standard wall -- roughly matching Doom's proportions.

---

### 3. Wall Height Projection (Core Formula Change)

**Files affected:**
- `src/common/drawing/wall-painter.ts:88` -- `convertDistanceToWallHeight`
- `src/common/drawing/wall-painter.ts:68-84` -- `createWall`
- `src/common/rendering/common/wall-drawing.ts:19` -- standalone utility
- `src/common/rendering/raycasting/renderer3d.ts:198` -- raycaster version

#### 3.1 Current Formula

```typescript
// Single formula, all walls same height, centered on horizon
convertDistanceToWallHeight = (d: number) => Math.round(10 * this.height / d);
startRow = Math.floor((this.height - wallHeight) / 2);
endRow = Math.floor((this.height + wallHeight) / 2);
```

The constant `10` is the world-space wall height. `this.height` is the canvas pixel height (480). At distance 10, a wall exactly fills the screen. Walls are always vertically centered.

#### 3.2 New Projection Model

The fundamental change: instead of computing a single centered wall height, we project **arbitrary world-space elevations** to screen rows.

```typescript
// Convert a world-space elevation to a screen row
// eyeZ = camera zPosition + eyeHeight (the projection reference point)
function worldToScreenRow(elevation: number, distance: number, eyeZ: number, screenHeight: number): number {
    // How far this elevation is below the eye level
    const relativeHeight = eyeZ - elevation;
    // Project to screen: positive relativeHeight = below horizon = lower screen rows
    // Factor of screenHeight/distance is the projection scale (same as current formula without the 10)
    return Math.round(screenHeight / 2 + relativeHeight * screenHeight / distance);
}
```

**Derivation:** In the current engine, the formula `10 * screenHeight / distance` gives the pixel height of a 10-unit wall at a given distance. Dividing by 10, we get `screenHeight / distance` as the pixels-per-world-unit at that distance. To place an elevation on screen, we compute its offset from the eye level (`eyeZ - elevation`), multiply by the projection scale, and add to the horizon line (`screenHeight / 2`).

**For each wall column, the renderer computes:**
```typescript
const topRow    = worldToScreenRow(wallTopElevation, distance, eyeZ, screenHeight);
const bottomRow = worldToScreenRow(wallBottomElevation, distance, eyeZ, screenHeight);
```

Where `wallTopElevation` and `wallBottomElevation` depend on the sector context (see Section 4).

#### 3.3 Relationship to the Old Formula

When `eyeZ = 5` (midpoint of a 0-to-10 wall) and the wall spans from 0 to 10:
```
topRow    = screenHeight/2 + (5 - 10) * screenHeight/distance
          = screenHeight/2 - 5 * screenHeight/distance

bottomRow = screenHeight/2 + (5 - 0) * screenHeight/distance
          = screenHeight/2 + 5 * screenHeight/distance

wallHeight = bottomRow - topRow = 10 * screenHeight / distance   ← same as current formula
```

The old formula is a special case of the new one. Backward compatibility is preserved when `eyeZ = ceilingHeight / 2` and all polygons have `floorHeight=0, ceilingHeight=10`.

---

### 4. Wall Segment Rendering

**Files affected:**
- `src/common/drawing/wall-painter.ts` -- `WallProps`, `createWall`, `drawWall`, `getTrapezoid`
- `src/common/rendering/common/wall-drawing.ts` -- standalone `WallProps` and `drawWall`
- `src/common/rendering/zbuffering/zbuffer-renderer.ts` -- `ZBuffer.add()`, `ZBuffer.render()`
- `src/common/rendering/raycasting/renderer3d.ts` -- `createWall`, `constructZBuffer`

#### 4.1 Multi-Segment Walls

Currently, each edge hit produces **one wall** spanning the full height. With sectors, each edge hit can produce **up to three wall segments**:

```
Sector A: floor=0, ceiling=10    Sector B: floor=3, ceiling=8
                                  Shared edge between A and B:

Screen column:
  ┌─────┐  ← screenTop
  │ sky  │
  │     │
  ├─────┤  ← topRow of upper wall (projects A ceiling = 10)
  │upper│  ← upper wall segment (A ceiling 10 → B ceiling 8)
  │wall │
  ├─────┤  ← bottomRow of upper wall (projects B ceiling = 8)
  │     │
  │open │  ← opening -- no wall drawn, see-through to sector B
  │     │
  ├─────┤  ← topRow of lower wall (projects B floor = 3)
  │lower│  ← lower wall segment (B floor 3 → A floor 0)
  │wall │
  ├─────┤  ← bottomRow of lower wall (projects A floor = 0)
  │floor│
  └─────┘  ← screenBottom
```

For **exterior edges** (no back sector), a single full wall segment is drawn from `floorHeight` to `ceilingHeight`.

#### 4.2 WallProps Structure Changes

```typescript
// A single drawable wall segment (one of potentially 1-3 per edge hit)
export type WallSegment = {
    worldTop: number,           // world-space top elevation of this segment
    worldBottom: number,        // world-space bottom elevation of this segment
    rowRange: [number, number], // screen rows [top, bottom]
    material: IMaterial,        // material for this segment
    segmentType: 'upper' | 'lower' | 'full',  // which part of the wall
};

export type WallProps = {
    edgeId: IEntityKey,
    segments: WallSegment[],     // 1-3 segments per column
    edgeLuminosity: number,
    intersection: Vector,
    origin: Vector,
    length: number,
    colRange: [number, number],
    distance: number,
    // Removed: height, rowRange, material (moved into segments)
};
```

**Alternative (simpler):** Instead of restructuring `WallProps`, emit multiple `WallProps` entries per edge hit -- one for each segment. This avoids changing the `WallProps` type but increases the number of entries in the ZBuffer. Each segment would have its own `rowRange` and `material`.

The simpler alternative is recommended for Phase 1 since it minimizes changes to `ZBuffer`, `ZBufferColumn`, and the drawing pipeline. The segments share the same `edgeId` (for grouping) but have different `rowRange` values.

#### 4.3 Segment Material Assignment

- **Full wall** (exterior edge): Uses the edge's own material.
- **Lower wall** (floor step): Uses the edge's material (or a dedicated "lower" material if we add one later).
- **Upper wall** (ceiling step): Uses the edge's material (or a dedicated "upper" material).
- **Opening** (passable gap): No wall drawn. The renderer draws nothing here, allowing the background (or portal view of the next sector) to show through.

For Phase 1, all segments use the same edge material. A future enhancement could add per-segment materials to edges.

#### 4.4 createWall Changes

```typescript
// wall-painter.ts -- createWall becomes createWallSegments
public createWallSegments = (
    hit: RayHit,
    rayIndex: number,
    frontSector: IPolygon | null,
    backSector: IPolygon | null,
    eyeZ: number,
    origin: Vector = null
): WallProps[] => {
    const d = hit.distance;
    const edgeId = hit.edge?.id || Guid.EMPTY;
    const material = lookupMaterialFor(hit.intersection, hit.edge);
    const colRange = [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex + 1)];

    const toRow = (elevation: number) => worldToScreenRow(elevation, d, eyeZ, this.height);

    if (!backSector) {
        // Exterior edge: single full wall
        const topRow = toRow(frontSector.ceilingHeight);
        const bottomRow = toRow(frontSector.floorHeight);
        return [{ edgeId, material, rowRange: [topRow, bottomRow], colRange, distance: d, ... }];
    }

    // Shared edge: compute lower and upper wall segments
    const segments: WallProps[] = [];

    // Lower wall: from min(floors) to max(floors)
    const lowerFloor = Math.min(frontSector.floorHeight, backSector.floorHeight);
    const upperFloor = Math.max(frontSector.floorHeight, backSector.floorHeight);
    if (upperFloor > lowerFloor) {
        segments.push({
            edgeId, material,
            rowRange: [toRow(upperFloor), toRow(lowerFloor)],
            colRange, distance: d, ...
        });
    }

    // Upper wall: from min(ceilings) to max(ceilings)
    const lowerCeiling = Math.min(frontSector.ceilingHeight, backSector.ceilingHeight);
    const upperCeiling = Math.max(frontSector.ceilingHeight, backSector.ceilingHeight);
    if (upperCeiling > lowerCeiling) {
        segments.push({
            edgeId, material,
            rowRange: [toRow(upperCeiling), toRow(lowerCeiling)],
            colRange, distance: d, ...
        });
    }

    return segments;
};
```

#### 4.5 Trapezoid Drawing

The `getTrapezoid` function (`wall-painter.ts:157-162`) and `drawTrapezoid` (`drawing.ts:43-52`) work unchanged. They accept a `rowRange` and `colRange` and produce a filled quadrilateral. The only change is that `drawWall` may be called multiple times per edge (once per segment) instead of once.

#### 4.6 Texture Mapping Impact

**File:** `src/common/textures/texture.ts:55-73`

Currently, texture V-coordinate spans the full wall height. With partial wall segments, the texture must be sampled from the correct vertical range:

```typescript
// Current: texture V spans [0, textureHeight] across full wall
// New: texture V must map to [worldBottom, worldTop] of the segment
//      relative to the full [sectorFloor, sectorCeiling] range

const fullWorldHeight = sectorCeiling - sectorFloor;  // e.g., 10
const segmentWorldTop = segment.worldTop;               // e.g., 10 (upper wall top)
const segmentWorldBottom = segment.worldBottom;          // e.g., 8 (upper wall bottom)

// Texture V range for this segment (0 = top of full wall, 1 = bottom)
const vTop = (sectorCeiling - segmentWorldTop) / fullWorldHeight;      // e.g., 0.0
const vBottom = (sectorCeiling - segmentWorldBottom) / fullWorldHeight; // e.g., 0.2

// Source rectangle in texture atlas:
const sourceY = Math.floor(vTop * textureHeight);
const sourceHeight = Math.floor((vBottom - vTop) * textureHeight);
```

This affects `texture.drawTexture()` which currently assumes the full texture height maps to the full wall height. The `drawImage` call's source Y and height parameters must be adjusted.

---

### 5. ZBuffer Renderer

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts`

This is the primary rendering path and the most impacted system.

#### 5.1 BSP Walk Phase (lines 70-126)

**Current:** For each polygon's edges, clip and add to ZBuffer.

**New:** The BSP walk itself doesn't change (it's a 2D spatial query). But when processing each edge (lines 86-108), the renderer must now:

1. Look up the edge's front/back sectors from the `EdgeSectorMap`
2. Pass sector height information to the wall creation step
3. Handle the case where an edge has no back sector (exterior) vs. shared edge

```typescript
// Current (simplified):
for (const e of polygon.edges) {
    if (e.material == null) continue;
    const clipped = clip(e, camera);
    if (clipped === NULL_EDGE) continue;
    buffer.add(clipped, e.start.vector);
}

// New:
for (const e of polygon.edges) {
    if (e.material == null) continue;
    const clipped = clip(e, camera);
    if (clipped === NULL_EDGE) continue;
    const sectorPair = edgeSectorMap.get(e.id);
    buffer.add(clipped, e.start.vector, sectorPair, camera.eyeZ);
}
```

#### 5.2 ZBuffer.add() (lines 259-301)

**Current:** Projects edge endpoints to column range, casts rays, creates one `WallProps` per column, inserts into `ZBufferColumn`.

**New:** After ray casting, `createWallSegments` (instead of `createWall`) returns 0-3 `WallProps` per column. Each segment is inserted into the `ZBufferColumn` separately, sorted by distance.

```typescript
// Current:
const wall = wallPainter.createWall(hit, column, unclippedStart);
if (wall) zbufferColumns[column].add(wall);

// New:
const segments = wallPainter.createWallSegments(hit, column, frontSector, backSector, eyeZ, unclippedStart);
for (const seg of segments) {
    zbufferColumns[column].add(seg);
}
```

#### 5.3 ZBuffer.render() (lines 233-257)

**Current:** Renders back-to-front, grouping consecutive columns with the same `edgeId`.

**New:** The grouping logic must account for the fact that the same edge can produce multiple segments. Two approaches:

1. **Segment-aware grouping:** Group by `(edgeId, segmentType)`. An upper wall segment and lower wall segment of the same edge are drawn as separate trapezoids.
2. **No grouping change:** Keep grouping by `edgeId` only, but `drawWall` internally iterates segments. This is simpler but means a single "wall group" may contain columns with different numbers of segments.

Option 1 is cleaner. The grouping key becomes a composite of edge ID and segment type.

#### 5.4 ZBufferColumn (lines 322-377)

**Current:** `isFull` returns true when any opaque wall exists (meaning everything behind it is occluded).

**New:** A column is fully occluded only when opaque walls **cover the entire vertical range** from screen top to screen bottom. A single opaque wall segment (e.g., a lower wall from row 300 to 480) only occludes the lower portion -- the upper portion may still show walls behind. This requires a more sophisticated occlusion check:

```typescript
// Simple approach: track the unoccluded row ranges per column
// A column is "full" when no unoccluded rows remain
class ZBufferColumn {
    private uncoveredTop: number = 0;       // highest uncovered row
    private uncoveredBottom: number = 480;  // lowest uncovered row

    isFull(): boolean {
        return this.uncoveredTop >= this.uncoveredBottom;
    }

    addOpaqueSegment(topRow: number, bottomRow: number) {
        if (topRow <= this.uncoveredTop) this.uncoveredTop = bottomRow;
        if (bottomRow >= this.uncoveredBottom) this.uncoveredBottom = topRow;
        // Note: this simplified approach doesn't handle "holes" in the middle
        // A full implementation would use an interval list
    }
}
```

**Important caveat from AGENTS.md:** "Cannot terminate early based on buffer is full because coplanar edges may be closer than already-processed edges." This constraint still applies. The `isFull` check is an optimization hint, not a termination condition.

---

### 6. Raycaster Renderer

**File:** `src/common/rendering/raycasting/renderer3d.ts`

The raycaster renderer follows the same pattern as the ZBuffer renderer but casts one ray per screen column instead of projecting edges.

#### 6.1 Ray Casting Phase (lines 94-103)

`castCollisionRays` returns `RayHit[]` per ray. Each hit must now be expanded into wall segments using the same `createWallSegments` logic.

#### 6.2 constructZBuffer (lines 153-182)

Currently iterates by depth layer, creating one `WallProps` per hit. Now each hit produces 1-3 segments. The depth layering must account for segments at the same distance.

#### 6.3 createWall (lines 74-91)

Must be updated to `createWallSegments` with sector height lookup, mirroring the `WallPainter` changes.

---

### 7. Floor and Ceiling Rendering

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts:166-195`

#### 7.1 Current Implementation

Sky fills the top half of the screen (`0` to `screenHeight/2`), floor fills the bottom half (`screenHeight/2` to `screenHeight`). Both are flat rectangles with solid or gradient colors.

#### 7.2 With Variable Heights

Floor and ceiling are no longer flat horizontal lines. Each screen column has a different floor/ceiling boundary depending on the sector being viewed.

**Three implementation tiers:**

##### Tier 1: Per-Column Flat Color (Simplest)

For each screen column, determine the visible sector at that column and compute the floor/ceiling screen rows:

```typescript
for (let col = 0; col < resolution; col++) {
    const sector = getSectorAtColumn(col);  // from the nearest wall hit
    const floorRow = worldToScreenRow(sector.floorHeight, distance, eyeZ, screenHeight);
    const ceilingRow = worldToScreenRow(sector.ceilingHeight, distance, eyeZ, screenHeight);

    // Draw ceiling from screen top to ceilingRow
    fillColumn(col, 0, ceilingRow, skyColor);
    // Draw floor from floorRow to screen bottom
    fillColumn(col, floorRow, screenHeight, floorColor);
}
```

This produces stepped floor/ceiling boundaries that follow the terrain. Cheap but visually acceptable.

##### Tier 2: Distance-Shaded Strips

Same as Tier 1, but apply distance-based color shading to each floor/ceiling pixel. Closer floor pixels are brighter, farther ones are darker. Provides depth cues.

##### Tier 3: Textured Visplanes (Doom-Style)

For each floor/ceiling pixel on screen, project it back to world space to determine the corresponding floor texture coordinate, then sample the texture. This is the most expensive approach but produces textured floors and ceilings.

```
For each screen row below a wall's bottom edge:
    For each pixel in that row:
        // Reverse-project screen position to world XY
        worldDistance = eyeZ * screenHeight / (row - screenHeight/2)
        worldX = camera.x + ray.dx * worldDistance
        worldY = camera.y + ray.dy * worldDistance
        // Sample floor texture at (worldX, worldY)
        color = floorTexture.sample(worldX % tileSize, worldY % tileSize)
```

**Recommendation:** Start with Tier 1. It's the minimum viable implementation and can be upgraded later without architectural changes.

---

### 8. Movement and Collision

**File:** `src/common/camera.ts:69-138`

#### 8.1 Current System

`constrainedMove` casts a 2D ray, finds the nearest solid edge, and either moves freely or wall-slides. `castCameraRay` (`raycaster.ts:19`) filters out `immaterial` edges.

#### 8.2 Height-Aware Collision

Movement collision must now consider height. An edge only blocks the player if it's **tall enough** to prevent passage:

```typescript
function canPassThroughEdge(edge: IEdge, frontSector: IPolygon, backSector: IPolygon, playerZ: number): boolean {
    if (!backSector) return false;  // exterior wall, always blocks

    // Can the player's feet reach the other side's floor?
    const targetFloor = backSector.floorHeight;
    const stepHeight = targetFloor - playerZ;
    if (stepHeight > MAX_STEP_HEIGHT) return false;  // too high to step up

    // Is the opening tall enough for the player?
    const openingHeight = backSector.ceilingHeight - Math.max(targetFloor, playerZ);
    if (openingHeight < PLAYER_HEIGHT) return false;  // too low to fit

    return true;
}
```

**Integration into `castCameraRay`:** The existing `edgeFilter` mechanism (`raycaster.ts:27`) can be extended:

```typescript
// Current filter: skip immaterial edges
edgeFilter: (e) => !e.immaterial

// New filter: skip immaterial edges AND passable height transitions
edgeFilter: (e) => {
    if (e.immaterial) return false;
    const sectorPair = edgeSectorMap.get(e.id);
    if (sectorPair?.back && canPassThroughEdge(e, sectorPair.front, sectorPair.back, playerZ)) {
        return false;  // opening is passable
    }
    return true;  // blocks movement
}
```

#### 8.3 Step-Up / Step-Down

When the player moves to a polygon with a slightly different floor height:

- **Step up (floor difference <= MAX_STEP_HEIGHT):** Instantly adjust `zPosition` to the new floor height (or smoothly interpolate over a few frames for visual polish).
- **Step down / ledge:** Set `zPosition` above the new floor and let gravity handle the descent.

```typescript
function handleFloorTransition(camera: ICamera, newSector: IPolygon): ICamera {
    const targetFloor = newSector.floorHeight;

    if (camera.zPosition > targetFloor) {
        // Stepping down -- gravity will handle it (do nothing, gravity system takes over)
        return camera;
    }
    if (targetFloor - camera.zPosition <= MAX_STEP_HEIGHT) {
        // Stepping up -- snap or interpolate
        return makeCamera({ ...camera, zPosition: targetFloor });
    }
    // Should not reach here if canPassThroughEdge was checked first
    return camera;
}
```

#### 8.4 Which Polygon Am I In?

Determining the player's current sector is needed for:
- Gravity target floor
- Step-up/down transitions
- Ceiling collision (head bumping)

The BSP `findClosest` function (`querying.ts:108`) finds the leaf node containing a point. However, BSP leaf nodes contain **split sub-polygons**, not original polygons. A mapping from split sub-polygon back to original polygon (and its heights) is needed. This can be stored during BSP construction.

**Simpler alternative:** Point-in-polygon test against all original polygons. For a small number of polygons this is fast enough. For larger maps, a spatial index (like the BSP itself) can accelerate the lookup.

---

### 9. Gravity System (New)

**No gravity exists in the current codebase.** This is an entirely new system.

#### 9.1 Constants

```typescript
const GRAVITY = 30;           // world units per second squared
const MAX_FALL_SPEED = 50;    // terminal velocity
const JUMP_VELOCITY = 15;     // initial upward velocity on jump (if jumping is added)
```

#### 9.2 Per-Frame Update

Location: `src/common/actions/cameraActionsHandler.ts` -- inside `handle(deltaTime)`, after movement processing.

```typescript
function applyGravity(camera: ICamera, currentSector: IPolygon, deltaTime: number): ICamera {
    const targetFloor = currentSector.floorHeight;
    let z = camera.zPosition;
    let vz = camera.zVelocity;

    if (z > targetFloor) {
        // In the air -- apply gravity
        vz -= GRAVITY * deltaTime;
        vz = Math.max(vz, -MAX_FALL_SPEED);
        z += vz * deltaTime;

        if (z <= targetFloor) {
            // Landed
            z = targetFloor;
            vz = 0;
        }
    } else if (z < targetFloor) {
        // Below floor (shouldn't happen normally) -- snap up
        z = targetFloor;
        vz = 0;
    }
    // else: on the ground, vz stays 0

    if (z === camera.zPosition && vz === camera.zVelocity) return camera; // no change
    return makeCamera({ ...camera, zPosition: z, zVelocity: vz });
}
```

#### 9.3 Game Loop Integration

```
Each frame:
  1. Process movement inputs (existing)
  2. Determine current sector (new point-in-polygon query)
  3. Apply gravity (new)
  4. Update Redux player state
  5. Render
```

The gravity update runs every frame regardless of player input. It must access geometry to find the current sector, which means the action handler needs geometry access (it already receives it for collision).

#### 9.4 Smooth Transitions

Instantly snapping `zPosition` when stepping up looks jarring. A smooth interpolation can be applied:

```typescript
// Instead of: zPosition = targetFloor
// Use: zPosition += (targetFloor - zPosition) * STEP_SMOOTHING * deltaTime
const STEP_SMOOTHING = 15;  // speed of step-up interpolation
```

This creates a smooth "stepping up" motion over 2-3 frames. Gravity naturally handles the downward case.

---

### 10. Serialization and Map Format

**Files:** `src/common/storage/load-world.ts`, `src/common/storage/stateLoader.ts`, `assets/maps/*.json`

#### 10.1 Stored Format Changes

```typescript
// IStoredPolygon gains optional height fields
export type IStoredPolygon = IEntity & {
    edges: IStoredEdge[],
    floorHeight?: number,     // default 0
    ceilingHeight?: number,   // default 10
};
```

#### 10.2 Backward Compatibility

Existing maps have no height data. On load, `loadPolygon` must default missing fields:

```typescript
function loadPolygon(stored: IStoredPolygon): IPolygon {
    // ... existing logic ...
    return {
        // ... existing fields ...
        floorHeight: stored.floorHeight ?? 0,
        ceilingHeight: stored.ceilingHeight ?? 10,
    };
}
```

This ensures all existing maps continue to work identically -- every polygon gets `floor=0, ceiling=10`, which produces the same rendering as the current engine (a flat world with 10-unit walls).

#### 10.3 Camera Serialization

The saved camera state must include `zPosition`, `eyeHeight`, and `zVelocity`. Backward-compatible defaults: `zPosition: 0`, `eyeHeight: 6`, `zVelocity: 0`.

---

### 11. Editor Impact

**Files:** `src/renderer/` -- editor components

The 2D editor needs UI for setting polygon heights. This is a separate concern from the rendering pipeline but affects the user workflow:

- **Property panel:** Add `floorHeight` and `ceilingHeight` input fields when a polygon is selected.
- **Visual feedback:** Optionally show height values or color-code polygons by elevation in the 2D editor view.
- **Height manipulation tools:** Raise/lower selected polygons, copy heights, etc.

The 2D editor itself remains 2D -- height editing is done through numeric inputs, not spatial manipulation.

---

### 12. Performance Considerations

#### 12.1 More Draw Calls

Each edge can now produce 1-3 wall segments instead of 1. In the worst case (every edge is a shared edge with different floor AND ceiling), draw calls triple. However:
- Many edges are exterior (1 segment)
- Many shared edges have matching floors or ceilings (1-2 segments)
- The `drawTrapezoid` call is cheap (Canvas2D fill)

Expected overhead: 20-50% more draw calls in complex scenes. Unlikely to be a bottleneck.

#### 12.2 Edge-Sector Map Lookup

The `EdgeSectorMap` lookup happens once per edge per frame. A `Map<string, SectorPair>` with O(1) lookup adds negligible cost.

#### 12.3 Point-in-Polygon Query

Determining the player's current sector (for gravity) happens once per frame. Even a brute-force test against all polygons is trivially fast for < 1000 polygons. The BSP `findClosest` can accelerate this if needed.

#### 12.4 Floor/Ceiling Rendering

Per-column floor/ceiling rendering (Tier 1) adds one `fillRect` per column for floor and ceiling. With 640 columns, that's up to 1280 extra fill calls. This is more expensive than the current two full-screen rectangles but still fast for Canvas2D.

---

### 13. Testing Impact

**Files:** `src/common/testing/factories/` -- test data factories

#### 13.1 Factory Updates

The polygon factory must produce polygons with height fields:

```typescript
// polygon factory afterBuild must include heights
Factory.define<IPolygon>(() => ({
    // ... existing fields ...
    floorHeight: 0,
    ceilingHeight: 10,
}));
```

#### 13.2 Existing Tests

All existing tests should pass without modification because:
- Default heights (0 and 10) reproduce current behavior
- The projection formula reduces to the current formula at these defaults
- Movement collision with default heights behaves identically (all walls are impassable full-height)

#### 13.3 New Tests Needed

| Area | Tests |
|---|---|
| Projection formula | Verify `worldToScreenRow` matches old formula at default heights |
| Multi-segment walls | Verify shared edges produce correct upper/lower segments |
| Step-up | Verify player can step onto small height differences |
| Step-down + gravity | Verify player falls and lands at correct height |
| Blocked passage | Verify player can't pass through walls taller than `MAX_STEP_HEIGHT` |
| BSP split height inheritance | Verify split sub-polygons retain parent heights |
| Backward compat | Verify existing maps render identically with default heights |

---

## Implementation Phases

### Phase 1: Data Model + Basic Rendering (Minimum Viable)
1. Add `floorHeight` / `ceilingHeight` to `IPolygon` and `IStoredPolygon`
2. Add `zPosition`, `eyeHeight`, `zVelocity` to camera
3. Replace wall height formula with elevation-based projection
4. Render exterior edges using absolute polygon heights
5. Update serialization with backward-compatible defaults
6. Verify existing maps render identically

### Phase 2: Sector Awareness
1. Build `EdgeSectorMap` (neighbor tracking)
2. Implement multi-segment wall rendering for shared edges
3. Height-aware movement collision (`canPassThroughEdge`)
4. Step-up / step-down logic

### Phase 3: Gravity + Vertical Movement
1. Implement gravity system in game loop
2. Add current-sector detection (point-in-polygon)
3. Smooth step-up interpolation
4. Optional: jumping

### Phase 4: Floor/Ceiling Rendering
1. Per-column floor/ceiling boundaries (Tier 1)
2. Distance-based floor shading (Tier 2)
3. Optional: textured visplanes (Tier 3)

### Phase 5: Polish
1. Texture V-coordinate mapping for partial wall segments
2. Editor UI for polygon heights
3. Height-aware BSP optimizations (occlusion by segment coverage)

---

## Summary: Impact by Severity

| Area | Impact | Complexity | Phase |
|---|---|---|---|
| IPolygon model | Add 2 fields | Low | 1 |
| Camera model | Add 3 fields | Low | 1 |
| Wall projection formula | Replace constant with elevation math | Medium | 1 |
| Map serialization | Add fields with defaults | Low | 1 |
| WallProps / wall segments | 1 wall -> 1-3 segments per edge | High | 2 |
| Edge-sector neighbor map | New system | High | 2 |
| ZBuffer renderer edge processing | Sector lookup + multi-segment | High | 2 |
| Raycaster renderer | Same changes as ZBuffer | High | 2 |
| Movement collision | Height-aware passability | Medium-High | 2 |
| Gravity system | Entirely new | Medium | 3 |
| Current-sector detection | Point-in-polygon query | Medium | 3 |
| Floor/ceiling rendering | Per-column height boundaries | Medium-High | 4 |
| Texture mapping | V-coordinate adjustment for segments | Medium | 5 |
| ZBufferColumn occlusion | Segment-aware coverage tracking | Medium | 5 |
| Editor UI | Height property editing | Medium | 5 |
| BSP split height inheritance | Copy heights during split | Low | 1 |
| Test factories | Add height fields | Low | 1 |
