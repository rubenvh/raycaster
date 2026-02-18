# Performance Analysis: Remaining Optimization Opportunities

**Date:** February 18, 2026
**Scope:** Full codebase analysis of rendering hot paths, geometry operations, BSP traversal, state management, and canvas drawing
**Complement to:** [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md) (documents already-applied optimizations T1-T8)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tier 1: Critical Per-Frame Allocation Hotspots](#tier-1-critical-per-frame-allocation-hotspots)
3. [Tier 2: Redundant Computations & Uncached Operations](#tier-2-redundant-computations--uncached-operations)
4. [Tier 3: Architectural & Design-Level Improvements](#tier-3-architectural--design-level-improvements)
5. [Tier 4: Canvas Rendering Pipeline](#tier-4-canvas-rendering-pipeline)
6. [Tier 5: BSP Build-Time Improvements](#tier-5-bsp-build-time-improvements)
7. [Prioritized Recommendations](#prioritized-recommendations)

---

## Executive Summary

The analysis identified **42 performance issues** across all major subsystems. The estimated per-frame allocation burden is **~15,000-20,000 short-lived objects** from the rendering hot path alone, creating significant GC pressure.

### Top 5 Highest-Impact Opportunities

| # | Issue | Location | Est. Allocs/Frame | Difficulty |
|---|-------|----------|-------------------|------------|
| 1 | `makeCameraRay` creates ~12 objects per ray, 641 rays/frame | `camera.ts:24-28` | ~7,700 | Medium |
| 2 | `clip()` deep-clones every visible edge (material, vertices, sqrt) | `camera.ts:138-157` | ~1,000-2,000 | Medium |
| 3 | `ZBuffer.add()` constructs 2 full IRay objects for screen projection | `zbuffer-renderer.ts:191-194` | ~200-400 | Medium |
| 4 | `detectCollisions()` allocates `new Set<string>` per ray for stats | `collision.ts:19,132` | ~640 Sets | Easy |
| 5 | `createWall()` allocates ~5 objects per column hit | `wall-painter.ts:38-53` | ~3,000 | Hard |

### Key Lesson from Prior Optimizations

T8 (scratch ray objects) was **reverted** because V8's generational GC handles short-lived objects efficiently. Mutating existing objects can be slower than creating new ones due to hidden class deoptimization. The recommendations below account for this -- focusing on **eliminating unnecessary work** rather than object pooling.

---

## Tier 1: Critical Per-Frame Allocation Hotspots

### 1.1 `makeCameraRay` -- ~7,700 allocations per frame

**File:** `src/common/camera.ts:24-28`
**Called from:** `makeRays()` (camera.ts:129-136), invoked every frame via `ZBuffer.updateCamera()` (zbuffer-renderer.ts:227)

```typescript
// Current: ~12 allocations per call, called 641 times per frame
const makeCameraRay = (factor: number, camera: ICameraData, midline: ILineSegment) => {
    let rayDir = vector.add(camera.direction, vector.scale(factor, camera.plane));  // 2 allocs (scale + add)
    let rayLine = [camera.position, vector.add(camera.position, rayDir)] as ILine;  // 2 allocs (add + tuple)
    return makeRay(camera.position, rayDir, lineAngle(midline, rayLine));           // lineAngle: 2 allocs, makeRay: ~6 allocs
};
```

**Breakdown of `makeRay` (collision.ts:23-33):**
```typescript
const makeRay = (p, d, angle) => {
    const line: ILine = [p, add(p, d)];    // alloc: add() + tuple
    const dn = normalize(d);               // alloc: normalize -> scale -> [number, number]
    return ({
        position: p, direction: d, dn,
        dperp: perpendicular(dn),           // alloc: [number, number]
        ood: [1/d[0], 1/d[1]],             // alloc: [number, number]
        line, angle,
        cosAngle: Math.cos(angle)           // expensive trig call
    });
};
```

**Total per frame:** 641 calls x ~12 allocations = **~7,692 short-lived arrays/objects**

**Optimization Opportunities:**

**(a) Fuse the `atan2` + `cos` trig pair.**
`lineAngle` (lineSegment.ts:18-22) calls `angleBetween` which computes `Math.atan2(cross(u,v), dot(u,v))`. Then `makeRay` calls `Math.cos(angle)`. These can be combined:

```typescript
// Instead of: cos(atan2(y, x))
// Use identity: cos(atan2(y, x)) = x / sqrt(x^2 + y^2)
const d = dot(u, v);
const c = cross(u, v);
const cosAngle = d / Math.sqrt(d * d + c * c);
```

This eliminates both `Math.atan2` and `Math.cos` calls (641 of each per frame), plus the 2 temporary vector allocations inside `lineAngle`.

**(b) Pre-allocate the rays array and update in-place.**
Since `makeRays` always produces 641 rays for a 640-resolution screen, the array can be allocated once and rays updated. While T8 showed that mutating `IRay` objects regressed, the issue was with *all* derived fields. A lighter approach: pre-compute the `factor` values (constant) and only recompute what changes when the camera moves.

**(c) Avoid `normalize` + `perpendicular` + `ood` when not needed.**
The ZBuffer path (zbuffer-renderer.ts:191-192) calls `makeRay` without needing `dn`, `dperp`, or `ood` -- it only uses the ray for `intersectRayPlane`. A lightweight `makeProjectionRay` that skips these would cut allocations by ~60% for the ZBuffer edge-projection path.

---

### 1.2 `clip()` Deep-Clones Every Visible Edge -- ~1,000-2,000 allocations per frame

**File:** `src/common/camera.ts:138-160`
**Called from:** ZBuffer BSP walk callback (zbuffer-renderer.ts:78-82), once per visible edge

```typescript
export const clip = (e: IEdge, camera: ICamera): IEdge => {
    // 6 classifyPointToPlane calls (cheap: dot product + comparison)
    // ...
    // EXPENSIVE: full deep clone
    return cloneEdge(e,
        clipStart ? intersectRaySegment(camera.cone.left, e.segment)?.point ?? ... : null,
        clipEnd   ? intersectRaySegment(camera.cone.right, e.segment)?.point ?? ... : null);
};
```

**`cloneEdge` call chain (edge.ts:60-66):**
```typescript
export const cloneEdge = (e: IEdge, start: Vector = null, end: Vector = null): IEdge => loadEdge({
    id: cloneKey(e.id),                // string allocation via .toString()
    start: start ? makeVertex(start) : cloneVertex(e.start),  // vertex object + vector array
    end: end ? makeVertex(end) : cloneVertex(e.end),           // vertex object + vector array
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),  // deep clone: object + [...color] spread + texture clone
});
// loadEdge internally computes: distance (sqrt + subtract alloc), slope, determineLuminosity, segment array
```

**Total per visible edge:** ~8-15 allocations depending on clipping.
**For 100 visible edges:** ~800-1,500 allocations per frame.

**Optimization: Lightweight `ClippedEdge` struct.**
The rendering pipeline only needs: the clipped segment coordinates, a reference to the original edge's material, and the edge ID. It does NOT need a full `IEdge` with recomputed `length`, `slope`, and `luminosity`.

```typescript
// Proposed: reference original edge, only store clipped segment
interface IClippedEdge {
    original: IEdge;          // reference (no clone)
    segment: ILineSegment;    // clipped coordinates only
    start: IVertex;           // clipped vertex (or original if not clipped)
    end: IVertex;             // clipped vertex (or original if not clipped)
}
```

This eliminates `cloneMaterial`, `cloneKey`, recomputation of `slope`/`length`/`luminosity`, and the `loadEdge` overhead. The `cloneVertex`/`makeVertex` for clipped endpoints would still be needed, but the material deep-clone (the largest cost) is eliminated.

**Important:** `cloneMaterial` (properties.ts:11-14) deep-clones color arrays with `[...m.color]` and texture objects. Since materials are never mutated during rendering, this clone is entirely unnecessary for the clip path.

---

### 1.3 `ZBuffer.add()` -- ~200-400 allocations per edge for screen projection

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts:189-209`
**Called from:** BSP walk callback, once per visible clipped edge

```typescript
public add(edge: IEdge, unclippedStart: Vector): void {
    // Two full makeRay calls just to project edge endpoints onto screen
    let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));  // ~7 allocs
    let eray = makeRay(this.camera.position, subtract(edge.end.vector, this.camera.position));     // ~7 allocs
    let sproj = intersectRayPlane(sray, this.screenPlane)?.point;   // 2 allocs (Intersection + point copy)
    let eproj = intersectRayPlane(eray, this.screenPlane)?.point;   // 2 allocs (Intersection + point copy)
    if (!sproj || !eproj) return;

    // Two distance() calls, each allocating a subtract vector + sqrt
    let scol = Math.ceil(distance(this.screenLeft, sproj)/this.screenLength * this.resolution);
    let ecol = Math.floor(distance(this.screenLeft, eproj)/this.screenLength * this.resolution);
    // ...
}
```

**Total per visible edge:** ~20 allocations for projection alone.

**Optimization: Direct screen projection without IRay construction.**
The entire purpose of these 4 lines is to find which screen columns an edge spans. This can be computed with simple parametric math:

```typescript
// Proposed: project point onto screen line directly
// Given camera position P, point Q, screen segment [S0, S1]:
// 1. Ray from P through Q intersects screen at parameter t
// 2. Screen column = t * resolution
// No IRay, no normalize, no perpendicular needed
function projectToScreenColumn(
    cameraPos: Vector, point: Vector,
    screenPlane: Plane, screenLeft: Vector,
    screenDir: Vector, invScreenLength: number,
    resolution: number
): number {
    // Compute ray direction
    const dx = point[0] - cameraPos[0];
    const dy = point[1] - cameraPos[1];
    // Intersect with screen plane: t = (plane.d - dot(plane.n, cameraPos)) / dot(plane.n, dir)
    const denom = screenPlane.n[0] * dx + screenPlane.n[1] * dy;
    if (Math.abs(denom) < 1e-10) return -1;
    const t = (screenPlane.d - screenPlane.n[0] * cameraPos[0] - screenPlane.n[1] * cameraPos[1]) / denom;
    // Project intersection point along screen
    const ix = cameraPos[0] + t * dx;
    const iy = cameraPos[1] + t * dy;
    const screenX = (ix - screenLeft[0]) * screenDir[0] + (iy - screenLeft[1]) * screenDir[1];
    return screenX * invScreenLength * resolution;
}
```

This is **zero-allocation** and avoids `normalize`, `perpendicular`, `Math.cos`, `Math.sqrt` -- replacing ~20 allocations and 4 expensive math calls with simple arithmetic.

The `screenDir` and `invScreenLength` can be cached alongside the existing `screenPlane` and `screenLeft` in `updateCachedValues()`.

---

### 1.4 `detectCollisions` / `createEmptyIntersection` -- 640+ Set allocations per frame

**File:** `src/common/geometry/collision.ts:19`
**Called from:** `intersectRayPolygons` (collision.ts:132), `intersectRay`/`intersectUntilBlocked` (querying.ts:76)

```typescript
// Called per BSP node visit per ray, or per polygon group
export const createEmptyIntersection = (): PolygonIntersections =>
    ({hits: [], stop: false, edgeCount: 0, polygonCount: 0, polygonIds: new Set<string>()});
```

In the raycasting path, `detectCollisions` (raycaster.ts:126) creates a new intersection result per ray. For BSP traversal, `createEmptyIntersection` is called at every split node (querying.ts:76), meaning O(nodes_visited) allocations per ray. With 640 rays and a tree of depth ~10-15, this is **~6,400-9,600 empty intersection objects + Sets per frame** in the raycasting path.

The ZBuffer path does NOT use this -- it walks the BSP tree differently (via `walkWithFrustum`). So this only affects the raycasting renderer.

**Optimization: Lazy Set allocation.**
```typescript
// Only allocate Set when polygon IDs are actually added
export const createEmptyIntersection = (): PolygonIntersections =>
    ({hits: [], stop: false, edgeCount: 0, polygonCount: 0, polygonIds: null});

// In intersectRayPolygons, lazily create:
if (result.polygonIds == null) result.polygonIds = new Set();
result.polygonIds.add(polygon.id);
```

Or better: since `polygonIds` is only used for stats display (not rendering logic), conditionally skip tracking entirely when stats are not being collected.

---

### 1.5 `accumulateStats` -- 1,920 allocations per frame (raycaster path)

**File:** `src/common/rendering/raycasting/raycaster.ts:109-122`
**Called from:** `castRays()` inner loop (raycaster.ts:47), once per ray

```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): CastingStats => {
    for (const x of iStats.polygons) {
        stats.polygons.add(x);
    }
    return ({                                   // New object literal per ray
        polygons: stats.polygons,
        edgeTests: [                            // New array per ray
            Math.min(stats.edgeTests[0], iStats.edgeCount),
            Math.max(stats.edgeTests[1], iStats.edgeCount)],
        polygonTests: [                         // New array per ray
            Math.min(stats.polygonTests[0], iStats.polygonCount),
            Math.max(stats.polygonTests[1], iStats.polygonCount)],
    });
};
```

**Per ray:** 1 object + 2 arrays = 3 allocations.
**Per frame:** 640 rays x 3 = **1,920 allocations.**

**Optimization: Mutate stats in-place.**
```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): void => {
    for (const x of iStats.polygons) stats.polygons.add(x);
    stats.edgeTests[0] = Math.min(stats.edgeTests[0], iStats.edgeCount);
    stats.edgeTests[1] = Math.max(stats.edgeTests[1], iStats.edgeCount);
    stats.polygonTests[0] = Math.min(stats.polygonTests[0], iStats.polygonCount);
    stats.polygonTests[1] = Math.max(stats.polygonTests[1], iStats.polygonCount);
};
```

This changes the return type from `CastingStats` to `void` and mutates in-place, eliminating all 1,920 allocations. The caller in `castRays` already owns the stats object, so there is no aliasing concern.

---

### 1.6 `createWall` -- ~3,000 allocations per frame

**File:** `src/common/drawing/wall-painter.ts:38-53`
**Called from:** `ZBuffer.add()` (zbuffer-renderer.ts:205), once per column hit per edge

```typescript
public createWall = (hit: RayHit, rayIndex: number, origin: Vector = null): WallProps => {
    const edgeId = hit.edge && hit.edge.id || Guid.EMPTY;
    return ({
        edgeId: cloneKey(edgeId),                   // .toString() string allocation
        height, edgeLuminosity: hit.edge?.luminosity,
        material: lookupMaterialFor(hit.intersection, hit.edge),
        intersection: hit.intersection?.point,
        origin: origin || hit.edge?.start?.vector,
        length: hit.edge?.length,
        rowRange: [startRow, endRow],               // 2-element array allocation
        colRange: [this.mapToColumn(rayIndex), this.mapToColumn(rayIndex + 1)],  // 2-element array allocation
        distance: hit.distance
    });
};
```

**Per call:** ~5 allocations (WallProps object + edgeId string + rowRange + colRange + possibly material lookup).
**For 20 visible edges averaging 30 columns each:** 600 calls x 5 = **~3,000 allocations.**

**Optimization: Struct-of-arrays (SoA) layout.**
Instead of creating a `WallProps` object per column hit, store parallel typed arrays:

```typescript
class ZBufferColumnData {
    distances: Float64Array;
    heights: Float64Array;
    luminosities: Float64Array;
    alphas: Float64Array;
    // ... reference arrays for materials, edges
    count: number;
    capacity: number;
}
```

This is a larger refactor but would eliminate most object allocations in the hot path and improve cache locality for the distance-sorting step.

A simpler intermediate optimization: avoid cloning the edge ID by using the original string reference directly (edge IDs are immutable strings, `.toString()` on a string returns the same reference in V8).

---

### 1.7 `intersectRayEdge` Allocates on Miss -- hundreds per frame

**File:** `src/common/geometry/collision.ts:154-166`

```typescript
export const intersectRayEdge = (ray: IRay, edge: IEdge, polygon: IPolygon): RayHit => {
    const intersection = intersectRaySegment(ray, edge.segment);
    if (intersection) {
        return {polygon, ray, edge, intersection,
                distance: distance(intersection.point, ray.line[0]) * ray.cosAngle};  // distance alloc
    }
    // MISS: still allocates a new object
    return {polygon: null, ray, edge, intersection: null, distance: 0};
};
```

Then in `castRaysOnEdgeRange` (raycaster.ts:102-103), a miss creates another wrapper:
```typescript
hits[r] = hit.intersection
    ? hit
    : { ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY };
```

**Per miss:** 2 object allocations. Most rays miss most edges, so this is a large multiplier.

**Optimization:** Return `null` on miss from `intersectRayEdge`, and handle null at the call sites. This is a breaking API change but eliminates one allocation per miss. In `castRaysOnEdgeRange`, use a pre-allocated sentinel miss object:

```typescript
const MISS_HIT: RayHit = Object.freeze({
    ray: null, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY
});
```

---

### 1.8 `distance()` Allocates Temporary Subtract Vector

**File:** `src/common/math/vector.ts:13`
**Called from:** collision.ts (intersectRayEdge), zbuffer-renderer.ts (add), vertex.ts, edge.ts (loadEdge), many others

```typescript
// Current: allocates a temporary [number, number]
const distance = (u: Vector, v: Vector): number => norm(subtract(u, v));
// Where: subtract = (u, v) => [u[0] - v[0], u[1] - v[1]]  -- allocates
// And:   norm = (u) => Math.sqrt(normSqr(u))
```

**Optimization: Inline the subtraction.**
```typescript
const distance = (u: Vector, v: Vector): number => {
    const dx = u[0] - v[0];
    const dy = u[1] - v[1];
    return Math.sqrt(dx * dx + dy * dy);
};
```

Zero allocations. Also add `distanceSqr` for comparison-only use cases:
```typescript
const distanceSqr = (u: Vector, v: Vector): number => {
    const dx = u[0] - v[0];
    const dy = u[1] - v[1];
    return dx * dx + dy * dy;
};
```

This single change ripples through the entire codebase, eliminating hundreds of temporary vector allocations per frame.

---

### 1.9 `clippedSegments` Debug Array -- built every frame, used ~1/60 of the time

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts:71,80`

```typescript
// Allocated EVERY frame
let clippedSegments: {segment: ILineSegment, depth: number}[] = [];
// ...inside BSP walk callback:
clippedSegments.push({ segment: clipped.segment, depth: count });  // object literal per visible edge
// ...
// Only dispatched to stats every 1 second (line 102-121)
```

**Per frame:** ~100 object literals for visible edges, plus the array, even when stats won't be dispatched (59 out of 60 frames at 60fps).

**Optimization: Conditionally build.**
```typescript
const shouldCollectStats = performance.now() - this.previousStatsTimestamp > 1000;
let clippedSegments = shouldCollectStats ? [] : null;
// ...
if (clippedSegments) clippedSegments.push({ segment: clipped.segment, depth: count });
```

---

## Tier 2: Redundant Computations & Uncached Operations

### 2.1 `zbuffer-core.ts` Recalculates Screen Constants Per Edge

**File:** `src/common/rendering/zbuffering/zbuffer-core.ts:243,250`

```typescript
// Called once PER EDGE -- these values are CONSTANT per frame
const screenPlane = createPlane(camera.screen);    // 3 vector allocs + 1 Plane object
const screenLength = segmentLength(camera.screen); // 1 subtract alloc + 1 sqrt
```

`createPlane` internally calls `normalize(perpendicular(subtract(...)))` -- 3 intermediate vector allocations plus the final plane object. `segmentLength` calls `distance` which allocates via `subtract`.

This is the benchmark/core variant (not the production renderer, which already caches these in T6-T7). But it means benchmark results don't reflect production performance characteristics.

**Fix:** Cache these in the `addEdgeToBuffer` caller or pass them as parameters.

---

### 2.2 `lineAngle` Allocates 2 Temporary Vectors Per Call

**File:** `src/common/math/lineSegment.ts:18-22`
**Called from:** `makeCameraRay` (641x/frame), `constrainedMove` (per movement)

```typescript
export const lineAngle = (a: ILineSegment, b: ILineSegment): number => {
    return angleBetween(
        subtract(a[1], a[0]),    // allocates [number, number]
        subtract(b[1], b[0]));   // allocates [number, number]
};
```

**Per frame from `makeCameraRay`:** 641 x 2 = 1,282 temporary vectors.

**Optimization: Inline with scratch vectors or fuse with cosAngle computation** (see 1.1a).

---

### 2.3 `isAABBBehindPlane` / `isAABBInFrontOfPlane` Allocate Inline Vectors

**File:** `src/common/geometry/bsp/querying.ts:22,36`
**Called from:** `isAABBOutsideFrustum` (querying.ts:40), per BSP node during frustum walk

```typescript
// Current: allocates [px, py] just to pass to dot()
return dot(plane.n, [px, py]) < plane.d;
```

**Optimization: Inline the dot product.**
```typescript
return plane.n[0] * px + plane.n[1] * py < plane.d;
```

Zero allocations. Called for up to 3 planes per BSP node during every frame's walk. With ~50 BSP nodes, this eliminates ~150 temporary arrays per frame.

---

### 2.4 `intersectRayEdge` Recomputes Distance from Intersection Point

**File:** `src/common/geometry/collision.ts:161`

```typescript
distance: distance(intersection.point, ray.line[0]) * ray.cosAngle
```

`intersectRaySegment` already computes the parametric `t1` value (line 103), which IS the distance along the ray direction. Since `ray.dn` is normalized, `t1` equals the unsigned distance from the ray origin to the intersection point. But `t1` is not exposed -- it's used internally and then discarded.

**Optimization:** Return `t1` from `intersectRaySegment` (or a variant):
```typescript
// Proposed: return parametric distance alongside intersection
return {
    point: [_point[0], _point[1]],
    face: c < 0 ? Face.exterior : Face.interior,
    t: t1  // parametric distance along ray
};
```

Then in `intersectRayEdge`:
```typescript
distance: intersection.t * ray.cosAngle  // No distance() call, no allocation
```

This eliminates a `distance()` call (which does `subtract` + `sqrt`) per hit.

---

### 2.5 `freeStrafe` Uses `rotate(PI/2)` Instead of `perpendicular`

**File:** `src/common/camera.ts:71`

```typescript
let n = vector.scale(Math.abs(ratio), vector.rotate(sign * Math.PI / 2, camera.direction));
```

`vector.rotate` (vector.ts:21) computes `Math.cos(PI/2)` and `Math.sin(PI/2)` and allocates a 2x2 matrix (3 array allocations). But rotating by exactly PI/2 is just `perpendicular`:

```typescript
// Proposed: avoid trig + matrix for 90-degree rotation
const perp = vector.perpendicular(camera.direction);
let n = vector.scale(Math.abs(ratio), sign > 0 ? perp : vector.negate(perp));
```

This eliminates 2 trig calls and 3 array allocations per strafe movement.

---

### 2.6 `makeRay` Computes `Math.cos(0) = 1` Unnecessarily in ZBuffer Path

**File:** `src/common/geometry/collision.ts:32`

```typescript
cosAngle: Math.cos(angle)  // angle defaults to 0 from ZBuffer.add() calls
```

When called from `ZBuffer.add()` (zbuffer-renderer.ts:191-192), angle is always 0 (the default parameter). `Math.cos(0) = 1` is always computed.

**Optimization:**
```typescript
cosAngle: angle === 0 ? 1 : Math.cos(angle)
```

Trivial but called ~40+ times per frame from the ZBuffer path.

---

### 2.7 `rotate` Allocates a 2x2 Matrix Via `createRotation`

**File:** `src/common/math/vector.ts:21,56-58`

```typescript
const rotate = (angle: number, u: Vector): Vector => matMultiply(createRotation(angle), u);

const createRotation = (angle: number): Matrix => {
    let c = Math.cos(angle), s = Math.sin(angle);
    return [[c, -s], [s, c]];  // 3 array allocations (outer + 2 inner)
};
```

**Optimization: Direct rotation without matrix.**
```typescript
const rotate = (angle: number, u: Vector): Vector => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c * u[0] - s * u[1], s * u[0] + c * u[1]];
};
```

Eliminates 3 of 4 array allocations per call. Called from camera rotation (every frame during turning) and `freeStrafe`.

---

### 2.8 `camera.direction` Magnitude Recomputed on Every Movement

**File:** `src/common/camera.ts:96`

```typescript
// In constrainedMove:
const dirNorm = vector.norm(cam.direction);
```

`camera.direction` is not a unit vector (default: `[0, 10]`). Its magnitude only changes via `adaptDepth` (rare). But `constrainedMove` recomputes `norm` (which does `sqrt(dot(d,d))`) on every movement.

**Optimization:** Cache `directionNorm` on the camera object in `makeCamera`:
```typescript
// In makeCamera:
return { ...data, screen, midline, cone, planes, directionNorm: vector.norm(data.direction) };
```

---

## Tier 3: Architectural & Design-Level Improvements

### 3.1 `renderer3d.ts` O(n^2) Array Spread in `constructZBuffer`

**File:** `src/common/rendering/raycasting/renderer3d.ts:159`

```typescript
// Inside reduce loop, per wall per column:
acc.set(currentWallGroup, [...acc.get(currentWallGroup) || [], wall]);
```

The spread `[...existing, newItem]` copies the entire existing array every time a wall is added to a group. For a wall spanning 100 columns, this creates arrays of size 1, 2, 3, ..., 100 -- **O(n^2) total copies** per wall group.

**Optimization: Use `push` instead of spread.**
```typescript
if (!acc.has(currentWallGroup)) acc.set(currentWallGroup, []);
acc.get(currentWallGroup).push(wall);
```

---

### 3.2 `isFull()` Linear Scan Does Not Short-Circuit

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts:212-218`

```typescript
public isFull(): boolean {
    let allFilled = true;
    for (let c of this.cols) {
        allFilled = allFilled && c.isFull();  // Does NOT short-circuit the loop
    }
    return allFilled;
}
```

Despite using `&&`, the `for` loop continues iterating all 640 columns even after finding one that's not full, because `allFilled &&` is evaluated as an expression, not as a loop break condition.

**Optimization (a): Early return.**
```typescript
public isFull(): boolean {
    for (const c of this.cols) {
        if (!c.isFull()) return false;
    }
    return true;
}
```

**Optimization (b): Maintain a counter (O(1) check).**
```typescript
private fullColumnCount: number = 0;

// In add(), when a column transitions to full:
if (column.isFull() && !wasFullBefore) this.fullColumnCount++;

// In clear():
this.fullColumnCount = 0;

public isFull(): boolean {
    return this.fullColumnCount >= this.cols.length;
}
```

---

### 3.3 Store Connector Broadcasts Every Dispatch to All Subscribers

**File:** `src/common/store/store-connector.ts`

The `connect()` function registers callbacks that fire on **every** Redux dispatch. With 10+ subscribers (map editor, 3D renderer, BSP walker, stats component, wall painter, etc.) and camera actions dispatching every frame, every subscriber's callback runs 60+ times per second regardless of whether the state they care about changed.

**Optimization: Selector-based subscriptions.**
```typescript
// Proposed: only invoke callback when selected state changes
export function connect<T>(selector: (state: AppState) => T, callback: (selected: T) => void): Unsubscribe {
    let previous = selector(store.getState());
    return store.subscribe(() => {
        const current = selector(store.getState());
        if (current !== previous) {
            previous = current;
            callback(current);
        }
    });
}
```

This is the standard pattern used by React-Redux's `useSelector` and would prevent most subscribers from executing on camera-movement dispatches.

---

### 3.4 Both Renderers Instantiated and Subscribed Simultaneously

**File:** `src/renderer/renderer.ts:41` (approximate)

Both `Renderer3d` (raycasting) and `ZBufferRenderer` are always instantiated and connected to the store, even though only one is active at a time. The inactive renderer still receives store updates and processes them.

**Optimization:** Only instantiate the active renderer. Use a factory pattern:
```typescript
let activeRenderer: IRenderer = null;
connect(state => state.worldConfig.renderer, (rendererType) => {
    activeRenderer?.dispose();
    activeRenderer = rendererType === 'zbuffer' ? new ZBufferRenderer(...) : new Renderer3d(...);
});
```

---

### 3.5 Camera Actions Dispatch Multiple Redux Actions Per Frame

**File:** `src/common/actions/cameraActionsHandler.ts:61-81`

Moving + turning in a single frame dispatches 2 separate Redux actions, each triggering all store subscribers. Combined with 3.3 (broadcast to all subscribers), this doubles the unnecessary work.

**Optimization: Batch camera updates into a single dispatch.**
```typescript
// Instead of:
dispatch(moveAction(geometry, camera));
dispatch(turnAction(camera));

// Use a combined action:
dispatch(updateCameraAction(geometry, camera));  // single dispatch
```

---

### 3.6 `raycast-core.ts` Uses `.filter()` Just to Count Valid Hits

**File:** `src/common/rendering/raycasting/raycast-core.ts:52`

```typescript
ray.hits.filter(h => h.distance !== Number.POSITIVE_INFINITY)  // allocates filtered array
```

This creates a new array per ray (640/frame) just to get its `.length` for counting.

**Optimization: Use a counting loop.**
```typescript
let validHits = 0;
for (const h of ray.hits) {
    if (h.distance !== Number.POSITIVE_INFINITY) validHits++;
}
```

---

### 3.7 `renderer3d.ts` Uses `Math.max(...640-element-array)`

**File:** `src/common/rendering/raycasting/renderer3d.ts:148-149`

```typescript
const indexes = rays.map(r => r.hits.length);    // allocates 640-element array
const maxDepth = Math.max(...indexes);            // spreads 640 elements onto call stack
```

**Optimization: Single-pass max scan.**
```typescript
let maxDepth = 0;
for (const r of rays) {
    if (r.hits.length > maxDepth) maxDepth = r.hits.length;
}
```

Eliminates the intermediate array and the stack spread.

---

### 3.8 PriorityDeque Is Overkill for ZBufferColumn

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts:238`

Each of the 640 `ZBufferColumn` instances uses a `PriorityDeque` (supports both min and max extraction) from an external library. But columns only use `push` and `shift` (min extraction). Most columns receive 1-3 walls.

For such small collections, a simple sorted insertion into a plain array would be faster:
```typescript
// For columns with typically 1-3 walls, insertion sort into a small array
// is faster than heap operations due to cache locality and lower overhead
public add(el: WallProps): void {
    const arr = this.walls;
    let i = arr.length;
    arr.push(el);
    while (i > 0 && arr[i - 1].distance > el.distance) {
        arr[i] = arr[i - 1];
        i--;
    }
    arr[i] = el;
}
```

---

### 3.9 WallProps Object Is Large -- SoA Layout Would Improve Cache Locality

**File:** `src/common/drawing/wall-painter.ts:12-23`

`WallProps` has 10+ fields. Hundreds are created per frame, then sorted by `distance`. During sorting, only the `distance` field is accessed, but the CPU must load entire `WallProps` objects into cache lines.

A Struct-of-Arrays (SoA) approach where `distance[]`, `height[]`, `edgeId[]` etc. are parallel arrays would:
- Improve cache hit rate during distance sorting (only distance values in cache)
- Reduce per-element allocation overhead (typed arrays vs objects)
- Enable potential SIMD-like batch operations

This is a significant refactor and should be considered only if profiling confirms the priority queue / sorting is a bottleneck.

---

## Tier 4: Canvas Rendering Pipeline

### 4.1 Three Canvas Fill Operations Per Textured Wall

**File:** `src/common/drawing/wall-painter.ts:60-95`

For a textured wall with fading enabled, three separate Canvas 2D operations execute:
1. `texture.drawTexture(context, wallProps)` -- draws texture via `drawImage` per column
2. `drawTrapezoid(context, ..., rgba(0,0,0,${1-lumen}))` -- luminosity darkening overlay
3. `this.applyFading(context, wallProps)` -- distance-based fade overlay

Each `drawTrapezoid` involves: `beginPath()`, 4x `moveTo/lineTo`, `closePath()`, `fillStyle=` (CSS string parsing), `fill()`.

**Optimization Options:**
- **Combine luminosity into texture draw:** Use `context.globalAlpha = lumen` before `drawImage`, drawing a darkened version in one pass
- **Pre-compute faded+luminosity texture tiles:** If textures are reused across frames, cache the luminosity-adjusted version
- **Use `putImageData` for the final composited column:** Build pixel data directly and write once, avoiding multiple fill operations

---

### 4.2 `getColor` Builds CSS String Per Wall -- Canvas Must Parse It

**File:** `src/common/drawing/wall-painter.ts:130-136`

```typescript
return `rgba(${color[0] * lumen},${color[1] * lumen},${color[2] * lumen},${color[3]})`;
```

Canvas 2D's `fillStyle` must parse this CSS color string internally each time. For solid-colored walls, this is called once per wall group.

**Optimization: Pre-compute color strings or use `fillStyle` with numeric values.**
Canvas 2D does not support numeric RGBA directly, but caching the string for repeated lumen values would help. Alternatively, for `OffscreenCanvas` or `ImageData` paths, use direct pixel manipulation.

---

### 4.3 `drawImage` Called Per Column in Texture Rendering

**File:** `src/common/textures/texture.ts:55-73`

```typescript
for (let windex = wallProps.length - 1; windex >= 0; windex--) {
    // Per column:
    target.drawImage(this.canvas, tx + col * twidth, row * theight, 1, theight, x1, y1, targetWidth, targetHeight);
}
```

Each `drawImage` call has overhead from the Canvas 2D API (source rect calculation, compositing setup). For a wall spanning 100 columns, this is 100 `drawImage` calls.

**Optimization:** Batch adjacent columns that use the same texture strip into a single wider `drawImage` call. Many adjacent columns may sample the same texture X coordinate, especially for walls viewed at steep angles.

---

### 4.4 `getTrapezoid` Allocates 5 Arrays Per Call

**File:** `src/common/drawing/wall-painter.ts:124-128`

```typescript
private getTrapezoid = (start: WallProps, end: WallProps): [Vector, Vector, Vector, Vector] => ([
    [start.colRange[1], start.rowRange[0] - 0.5],   // new [number, number]
    [start.colRange[1], start.rowRange[1] + 0.5],   // new [number, number]
    [end.colRange[0], end.rowRange[1] + 0.5],       // new [number, number]
    [end.colRange[0], end.rowRange[0] - 0.5]]);     // new [number, number]
```

5 array allocations (4 inner + 1 outer) per call, called 2-3 times per wall draw.

**Optimization: Pre-allocate a scratch trapezoid.**
```typescript
private _trapezoid: [Vector, Vector, Vector, Vector] = [[0,0],[0,0],[0,0],[0,0]];

private getTrapezoid = (start: WallProps, end: WallProps): [Vector, Vector, Vector, Vector] => {
    this._trapezoid[0][0] = start.colRange[1]; this._trapezoid[0][1] = start.rowRange[0] - 0.5;
    this._trapezoid[1][0] = start.colRange[1]; this._trapezoid[1][1] = start.rowRange[1] + 0.5;
    this._trapezoid[2][0] = end.colRange[0];   this._trapezoid[2][1] = end.rowRange[1] + 0.5;
    this._trapezoid[3][0] = end.colRange[0];   this._trapezoid[3][1] = end.rowRange[0] - 0.5;
    return this._trapezoid;
};
```

Zero allocations. Safe as long as the caller consumes the trapezoid before the next `getTrapezoid` call (which it does -- the trapezoid is immediately passed to `drawTrapezoid`).

---

### 4.5 `applyFading` Creates CanvasGradient + `toFixed()` Strings Per Wall

**File:** `src/common/drawing/wall-painter.ts:97-121`

```typescript
context.createLinearGradient(...)  // API object creation
// ...
return gradient.addColorStop(t, `rgba(${this.fadeColor},${alpha.toFixed(2)})`);  // string allocation + toFixed
```

`toFixed(2)` is relatively expensive for a hot path. `createLinearGradient` creates a CanvasGradient object per wall group.

**Optimization:** Pre-compute a lookup table of alpha values (quantized to, e.g., 100 levels) with pre-built CSS strings:
```typescript
const FADE_ALPHA_STRINGS: string[] = Array.from({length: 101}, (_, i) =>
    `rgba(0,0,0,${(i / 100).toFixed(2)})`);
```

---

### 4.6 `getTextureAsImage` Creates New Canvas + `toDataURL()` On Every Call

**File:** `src/common/textures/texture.ts:75-86`

```typescript
public getTextureAsImage(): string {
    const canvas = document.createElement('canvas');    // new Canvas element
    // ... draw texture onto canvas ...
    return canvas.toDataURL();                          // expensive: PNG encode + base64
}
```

This creates a new Canvas element and calls `toDataURL()` (which involves PNG encoding) every time. If called from a component that re-renders on state changes, this is extremely expensive.

**Optimization:** Cache the data URL. Since textures are immutable after loading, compute once and store:
```typescript
private cachedDataUrl: string = null;

public getTextureAsImage(): string {
    if (!this.cachedDataUrl) {
        const canvas = document.createElement('canvas');
        // ... draw ...
        this.cachedDataUrl = canvas.toDataURL();
    }
    return this.cachedDataUrl;
}
```

---

### 4.7 TextureLibrary Recreates ALL Textures When Sources Change

**File:** `src/common/textures/textureLibrary.ts:17` (approximate)

When the texture sources array changes in the store, the entire library is rebuilt from scratch. Each `Texture` object involves creating a Canvas, drawing pixel data, and possibly encoding.

**Optimization:** Diff the texture sources and only recreate changed textures. Use a `Map<textureId, Texture>` and invalidate individual entries.

---

### 4.8 Byte-by-Byte String Concatenation for Base64 Encoding

**File:** `src/common/store/textures.ts:22-25` (approximate)

```typescript
// Raw pixels to base64 encoding using string concatenation
let binaryString = '';
for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
}
```

String concatenation in a loop creates O(n^2) intermediate strings. For a 64x64 RGBA texture, that's 16,384 iterations.

**Optimization:** Use `btoa()` with `Uint8Array` to string conversion, or use `TextDecoder`/`Blob` for more efficient encoding.

---

## Tier 5: BSP Build-Time Improvements

These do not affect per-frame rendering performance but impact map loading time and BSP tree quality.

### 5.1 `searchSplitPlane` Is O(n^2) with Per-Iteration Array Allocation

**File:** `src/common/geometry/bsp/splitting-strategies.ts:62-90`

```typescript
for (const polygon of polygons) {
    // ...
    for (const testPolygon of polygons.filter(_ => _ !== polygon)) {  // new filtered array per outer iteration
```

**Fix:** Replace `filter` with inline `continue`:
```typescript
for (const testPolygon of polygons) {
    if (testPolygon === polygon) continue;
```

Also replace `new Map<PolygonToPlaneRelation, number>()` (line 71) with three local counters:
```typescript
let numFront = 0, numBehind = 0, numStraddling = 0;
```

---

### 5.2 Debug Validation in `buildBspTree` Always Runs

**File:** `src/common/geometry/bsp/creation.ts:41-42`

```typescript
// These run on EVERY straddling polygon during BSP construction
if (!front.vertices.map(v => classifyPointToPlane(v.vector, splitPlane)).every(c => ...)) { console.log(...); }
if (!back.vertices.map(v => classifyPointToPlane(v.vector, splitPlane)).every(c => ...)) { console.log(...); }
```

Two `.map().every()` chains allocating temporary arrays per straddling polygon, even in production.

**Fix:** Wrap in `if (process.env.NODE_ENV !== 'production')` or a DEBUG flag.

---

### 5.3 `classifyPolygonToPlane` Doesn't Early-Exit on Straddling

**File:** `src/common/geometry/bsp/classification.ts:16-33`

```typescript
for (const vertex of polygon.vertices) {
    switch (classifyPointToPlane(vertex.vector, plane)) {
        case PointToPlaneRelation.InFront: numInFront++; break;
        case PointToPlaneRelation.Behind: numBehind++; break;
    }
}
// Check happens AFTER full iteration
if (numBehind != 0 && numInFront != 0) { return PolygonToPlaneRelation.Straddling; }
```

**Fix:** Add early exit inside the loop:
```typescript
if (numInFront > 0 && numBehind > 0) return PolygonToPlaneRelation.Straddling;
```

---

### 5.4 `closestToMidpoint` Recomputes Center on Every Sort Comparison

**File:** `src/common/geometry/bsp/splitting-strategies.ts:15-21`

```typescript
vs.sort((a, b) => {
    return distance(centerOf(polygon.boundingBox), a.vector) < distance(...) ? -1 : 1;
});
```

`centerOf` (which calls `midpoint`) is recomputed in every comparison, and `distance` (with `sqrt`) is called twice per comparison.

**Fix:** Cache the center, use squared distance, consider a 2-element min-scan instead of full sort:
```typescript
const center = centerOf(polygon.boundingBox);
// Only need the 2 closest -- use min-scan, not sort
```

---

### 5.5 `previousSplitPlane` Not Forwarded to Recursive Calls

**File:** `src/common/geometry/bsp/creation.ts:50-51`

```typescript
const frontTree = buildBspTree(frontList, depth + 1, maxDepth);  // defaults to VOID_PLANE
const backTree = buildBspTree(backList, depth + 1, maxDepth);    // defaults to VOID_PLANE
```

Should forward `splitPlane` to prevent re-selecting the same splitting plane in child nodes:
```typescript
const frontTree = buildBspTree(frontList, depth + 1, maxDepth, splitPlane);
const backTree = buildBspTree(backList, depth + 1, maxDepth, splitPlane);
```

---

### 5.6 All 5 Splitting Strategies Run for Every Polygon Set

**File:** `src/common/geometry/bsp/splitting.ts:18-28`

`pickSplittingPlane` runs all 5 strategies (some O(n^2)) at every recursion level with no early-out for "good enough" scores.

**Optimization:** Add early termination when a perfect split (score approaching optimal) is found.

---

## Prioritized Recommendations

### Quick Wins (< 1 hour each, measurable impact)

| # | Change | Files | Expected Impact |
|---|--------|-------|-----------------|
| 1 | Inline `distance()` to avoid subtract allocation | `vector.ts` | Eliminates ~500-1,000 temp arrays/frame |
| 2 | Short-circuit `isFull()` with early return | `zbuffer-renderer.ts` | O(640) to O(1) amortized check |
| 3 | Inline dot product in `isAABBBehindPlane`/`InFrontOfPlane` | `querying.ts` | Eliminates ~150 temp arrays/frame |
| 4 | Conditional `clippedSegments` collection | `zbuffer-renderer.ts` | Eliminates ~100 objects on 59/60 frames |
| 5 | `accumulateStats` mutate in-place | `raycaster.ts` | Eliminates 1,920 objects/frame |
| 6 | Replace `rotate` with direct computation | `vector.ts` | Eliminates 3 arrays per rotation |
| 7 | Fuse `atan2`+`cos` in `makeCameraRay` | `camera.ts`, `collision.ts` | Eliminates 641 trig pairs/frame |
| 8 | `classifyPolygonToPlane` early exit | `classification.ts` | Faster BSP build |
| 9 | Replace `searchSplitPlane` filter with continue | `splitting-strategies.ts` | Eliminates O(n) arrays per candidate |
| 10 | Wrap debug validation in BSP build | `creation.ts` | Eliminates .map().every() in production |

### Medium Effort (2-4 hours each, significant impact)

| # | Change | Files | Expected Impact |
|---|--------|-------|-----------------|
| 11 | Direct screen projection in `ZBuffer.add()` | `zbuffer-renderer.ts` | Eliminates ~400 objects/frame + trig |
| 12 | Lightweight `ClippedEdge` in `clip()` | `camera.ts`, `edge.ts` | Eliminates ~1,000-2,000 deep clones/frame |
| 13 | Selector-based store subscriptions | `store-connector.ts` | Eliminates redundant subscriber work |
| 14 | Lazy `Set` allocation in `createEmptyIntersection` | `collision.ts` | Eliminates ~640+ Sets/frame (raycast path) |
| 15 | Expose `t1` from `intersectRaySegment` | `collision.ts` | Eliminates distance recomputation per hit |
| 16 | Return null from `intersectRayEdge` on miss | `collision.ts`, `raycaster.ts` | Eliminates 2 objects per miss |
| 17 | Cache `getTextureAsImage` data URL | `texture.ts` | Eliminates repeated PNG encoding |
| 18 | Pre-allocate scratch trapezoid | `wall-painter.ts` | Eliminates 10-15 arrays per wall draw |
| 19 | Batch camera dispatches | `cameraActionsHandler.ts` | Halves subscriber invocations/frame |

### Large Effort (4+ hours, architectural changes)

| # | Change | Files | Expected Impact |
|---|--------|-------|-----------------|
| 20 | SoA layout for ZBuffer columns | `zbuffer-renderer.ts`, `wall-painter.ts` | Major cache locality improvement |
| 21 | Only instantiate active renderer | `renderer.ts` | Eliminates idle renderer overhead |
| 22 | Combine texture + luminosity + fade into single draw | `wall-painter.ts`, `texture.ts` | 3x fewer Canvas fill ops |
| 23 | Replace PriorityDeque with sorted small array | `zbuffer-renderer.ts` | Better cache locality for small n |
| 24 | Pre-allocate rays array, update in-place | `camera.ts`, `zbuffer-renderer.ts` | Eliminates ~7,700 allocs/frame (needs careful benchmarking per T8 lesson) |

### Not Recommended

| Change | Reason |
|--------|--------|
| Object pooling for IRay (T8 was reverted) | V8 handles short-lived objects well; mutation overhead exceeds GC savings |
| Flat array BSP layout | V8 optimizes pointer traversal well for typical tree depths (~40); refactor cost is very high |
| Recursive to iterative BSP walk | Short-circuit boolean chain makes conversion complex; depth ~40 is within V8 limits |

---

## Appendix: Allocation Estimates Per Frame

Based on 640-column resolution, ~100 visible edges, ~20 polygon groups, ~50 BSP nodes:

| Source | Allocations | Type |
|--------|------------|------|
| `makeCameraRay` x 641 | ~7,700 | Arrays, objects |
| `clip()` x 100 edges | ~1,000-2,000 | Deep clones, strings |
| `createWall` x 600 hits | ~3,000 | Objects, tuples |
| `ZBuffer.add()` rays x 100 | ~2,000 | IRay objects, vectors |
| `accumulateStats` x 640 | ~1,920 | Objects, arrays |
| `detectCollisions` x 640 | ~640+ | Sets |
| `intersectRayEdge` misses | ~500-1,000 | Objects |
| `lineAngle` x 641 | ~1,282 | Vectors |
| `clippedSegments` x 100 | ~100 | Objects |
| `isAABBBehind/InFront` x 150 | ~150 | Vectors |
| `distance()` misc | ~500 | Vectors |
| **Estimated Total** | **~18,000-20,000** | **per frame** |

At 60fps, this is roughly 1 million short-lived objects per second from the rendering hot path alone.
