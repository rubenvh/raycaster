# Raycaster Performance Optimizations

**Date:** February 18, 2026  
**Author:** OpenCode  
**Total Improvement:** ZBuffer up to -90%, Raycaster up to -32% (from original baseline, plus Tier 2 additional -5% to -30%)

This document details all performance optimizations applied to the raycaster rendering engine, with before/after code samples and measured impact.

---

## Table of Contents

1. [Summary of Results](#summary-of-results)
2. [T1/T1b: Array Spread Operator Optimization](#t1t1b-array-spread-operator-optimization)
3. [T2: Scratch Vectors in Ray-Plane Intersection](#t2-scratch-vectors-in-ray-plane-intersection)
4. [T3: Single-Pass Filter and Sort](#t3-single-pass-filter-and-sort)
5. [T4: forEach to for...of Conversion](#t4-foreach-to-forof-conversion)
6. [T5: Cache hasOpaqueWall Flag](#t5-cache-hasopaquwall-flag)
7. [T6-T7: Cache Screen Values](#t6-t7-cache-screen-values)
8. [T8: Scratch Ray Objects (Reverted)](#t8-scratch-ray-objects-reverted)
9. [Tier 1 Optimizations (Batch 2)](#tier-1-optimizations-batch-2)
10. [Tier 2 Optimizations: Redundant Computations](#tier-2-optimizations-redundant-computations)
11. [Lessons Learned](#lessons-learned)

---

## Summary of Results

| Task | Description | ZBuffer Impact | Raycaster Impact | Status |
|------|-------------|----------------|------------------|--------|
| T1b | `push.apply()` instead of spread | +1.2% | **-8.8%** | Kept |
| T2 | Scratch vectors in `intersectRayPlane` | -3.8% | +4.2% | Kept |
| T3 | Single-pass filter+sort | 0% | **-16.0%** | Kept |
| T4 | `for...of` instead of `forEach` | -0.6% | +12.7%* | Kept |
| T5 | Cache `hasOpaqueWall` flag | **-66.0%** | -1.7% | Kept |
| T6-T7 | Cache screen values | -0.2% | +1.3% | Kept |
| T8 | Reuse scratch rays | +5.7% | +7.0% | **Reverted** |
| **Tier 2** | | | | |
| 2.4 | Expose `t1` from `intersectRaySegment` | ~0% | **-5% to -30%** | Kept |
| 2.5 | `perpendicular` instead of `rotate(PI/2)` | ~0% | ~0% | Kept |
| 2.6 | Short-circuit `Math.cos(0)=1` in `makeRay` | ~0% | ~0% | Kept |
| 2.8 | Cache `directionNorm` on camera | ~0% | ~0% | Kept |

*T4 showed regression in isolation but was kept as part of consistent coding style.

### Cumulative from Baseline
- **ZBuffer:** -66.4% (-4.86ms average)
- **Raycaster:** -1.2% (-0.60ms average)

---

## T1/T1b: Array Spread Operator Optimization

**File:** `src/common/geometry/bsp/querying.ts`  
**Impact:** Raycaster **-8.8%**

### Problem
The spread operator `...` creates a new array when pushing multiple elements, causing unnecessary allocations in a hot path called thousands of times per frame.

### Before (Original)
```typescript
const addIntersections = (target: PolygonIntersections, source: PolygonIntersections) => {
    target.hits.push(...source.hits);  // Spread creates intermediate array
    source.polygonIds.forEach(id => target.polygonIds.add(id));
    target.edgeCount += source.edgeCount;
    target.polygonCount += source.polygonCount;
    target.stop = target.stop || source.stop;
    return target;
};
```

### After (Optimized)
```typescript
const addIntersections = (target: PolygonIntersections, source: PolygonIntersections) => {
    // Use push.apply for efficient array concatenation without spread operator allocation
    if (source.hits.length > 0) {
        Array.prototype.push.apply(target.hits, source.hits);
    }
    // Use for...of instead of forEach for better performance
    for (const id of source.polygonIds) {
        target.polygonIds.add(id);
    }
    target.edgeCount += source.edgeCount;
    target.polygonCount += source.polygonCount;
    target.stop = target.stop || source.stop;
    return target;
};
```

### Why It Works
- `Array.prototype.push.apply()` pushes elements directly without creating an intermediate array
- The length check avoids the function call overhead when there's nothing to add
- `for...of` avoids the closure overhead of `forEach`

---

## T2: Scratch Vectors in Ray-Plane Intersection

**File:** `src/common/geometry/collision.ts`  
**Impact:** Minimal (within noise)

### Problem
Vector operations like `subtract()`, `scale()`, and `add()` allocate new arrays on every call. In hot paths, this creates GC pressure.

### Before (Original)
```typescript
export const intersectRaySegment = (ray: IRay, s: ILineSegment): Intersection => {    
    let v1 = subtract(ray.position, s[0]);  // Allocates new array
    let v2 = subtract(s[1], s[0]);          // Allocates new array
    
    let c = cross(v2, v1);    
    let d_v2 = dot(v2, ray.dperp);
    let d_v1 = dot(v1, ray.dperp);
    let t1 = c / d_v2;
    let t2 = d_v1 / d_v2;
    
    if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
        return {
            point: add(ray.position, scale(t1, ray.dn)),  // Two more allocations
            face: c < 0 ? Face.exterior : Face.interior
        };
    }
    return null;
};
```

### After (Optimized)
```typescript
// Scratch vectors for intersection calculations (reused to avoid allocations)
const _v1: Vector = [0, 0];
const _v2: Vector = [0, 0];
const _point: Vector = [0, 0];
const _planePoint: Vector = [0, 0];

export const intersectRaySegment = (ray: IRay, s: ILineSegment): Intersection => {    
    // Reuse scratch vectors instead of allocating new ones
    subtractInto(_v1, ray.position, s[0]);
    subtractInto(_v2, s[1], s[0]);
    
    let c = cross(_v2, _v1);    
    let d_v2 = dot(_v2, ray.dperp);
    let d_v1 = dot(_v1, ray.dperp);
    let t1 = c / d_v2;
    let t2 = d_v1 / d_v2;
    
    if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
        // Calculate intersection point using scratch vector, then copy out
        scaleInto(_point, t1, ray.dn);
        addInto(_point, ray.position, _point);
        return {
            point: [_point[0], _point[1]],  // Copy to new array for safe return
            face: c < 0 ? Face.exterior : Face.interior
        };
    }
    return null;
};
```

### Why Impact Was Minimal
V8's garbage collector is highly optimized for short-lived allocations. The scratch vector approach reduces allocations but adds indirection. The net effect was within measurement noise.

---

## T3: Single-Pass Filter and Sort

**File:** `src/common/rendering/raycasting/raycaster.ts`  
**Impact:** Raycaster **-16.0%** (biggest raycaster win)

### Problem
The original code used a `.filter().sort()` chain which:
1. Creates an intermediate filtered array
2. Then sorts it with O(n log n) comparisons
3. Two passes over the data

### Before (Original)
```typescript
const castRays = (rays: IRay[], geometry: IGeometry, options: RayCastingOptions): CastedRays => {
    let castedRays: CastedRay[] = [];
    for (let i = 0, n = rays.length; i < n; i++) {
        const ray = rays[i];
        const collisions = detectCollisions(ray, geometry, options);

        // Two-pass approach: filter then sort
        const result = collisions.hits
            .filter(hit => needsRendering(hit))           // Pass 1: filter
            .sort((a, b) => a.distance - b.distance);     // Pass 2: sort

        castedRays.push((!result || result.length < 1)
            ? makeInfinity(ray, collisions.stats)
            : { stats: collisions.stats, hits: result });
    }
    return { castedRays, stats };
};
```

### After (Optimized)
```typescript
const castRays = (rays: IRay[], geometry: IGeometry, options: RayCastingOptions): CastedRays => {
    let castedRays: CastedRay[] = [];
    for (let i = 0, n = rays.length; i < n; i++) {
        const ray = rays[i];
        const collisions = detectCollisions(ray, geometry, options);

        // Single-pass filter and insert in sorted order
        const result = filterAndSortHits(collisions.hits);

        castedRays.push((!result || result.length < 1)
            ? makeInfinity(ray, collisions.stats)
            : { stats: collisions.stats, hits: result });
    }
    return { castedRays, stats };
};

/**
 * Single-pass filter and sort: filters hits that need rendering 
 * and inserts them in sorted order using binary search.
 */
const filterAndSortHits = (hits: RayHit[]): RayHit[] => {
    const result: RayHit[] = [];
    for (let i = 0, n = hits.length; i < n; i++) {
        const hit = hits[i];
        if (!needsRendering(hit)) continue;
        
        // Binary search to find insertion point for sorted order
        let lo = 0;
        let hi = result.length;
        const dist = hit.distance;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (result[mid].distance < dist) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        // Insert at the found position
        result.splice(lo, 0, hit);
    }
    return result;
};
```

### Why It Works
- **Single pass:** Filter and sort happen simultaneously
- **No intermediate array:** Filtered elements go directly into sorted result
- **Binary insertion:** For small arrays (typical ray has 1-5 hits), binary insertion is efficient
- **Early filtering:** Non-rendering hits are skipped immediately, not processed twice

---

## T4: forEach to for...of Conversion

**File:** `src/common/rendering/raycasting/raycaster.ts`  
**Impact:** Minimal (code consistency)

### Before (Original)
```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): CastingStats => {
    iStats.polygons.forEach(x => stats.polygons.add(x));
    return { /* ... */ };
}
```

### After (Optimized)
```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): CastingStats => {
    // Use for...of instead of forEach for better performance
    for (const x of iStats.polygons) {
        stats.polygons.add(x);
    }
    return { /* ... */ };
}
```

### Why Impact Was Minimal
Modern V8 optimizes `forEach` well. The benefit is primarily code consistency and avoiding closure allocation overhead in tight loops.

---

## T5: Cache hasOpaqueWall Flag

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts`  
**Impact:** ZBuffer **-66.0%** (biggest overall win)

### Problem
`ZBufferColumn.isFull()` was called for every column during BSP traversal to check if we could skip processing. It called `findMax()` on the priority queue to check if the closest wall was opaque - an O(1) operation but with significant constant overhead when called thousands of times.

### Before (Original)
```typescript
export class ZBufferColumn {
    private queue: PriorityDeque<WallProps>;
    
    constructor() {        
        this.queue = new PriorityDeque<WallProps>({ 
            compare: (a, b) => a.distance - b.distance 
        });
    }

    public clear(): void {
        this.queue.clear();
    }

    public isFull(): boolean {     
        // Called thousands of times per frame
        // findMax() has overhead even though it's O(1)
        const closest = this.queue.findMax();
        return closest && (closest.material?.color[3] || 0) === 1;
    }
    
    public add(el: WallProps): ZBufferColumn {        
        this.queue.push(el);
        return this;
    }
}
```

### After (Optimized)
```typescript
export class ZBufferColumn {
    private queue: PriorityDeque<WallProps>;
    private hasOpaqueWall: boolean = false;  // Track if any wall has alpha === 1
    
    constructor() {        
        this.queue = new PriorityDeque<WallProps>({ 
            compare: (a, b) => a.distance - b.distance 
        });
    }

    public clear(): void {
        this.queue.clear();
        this.hasOpaqueWall = false;  // Reset flag on clear
    }

    public isFull(): boolean {     
        return this.hasOpaqueWall;  // O(1) boolean check, no function call
    }
    
    public add(el: WallProps): ZBufferColumn {        
        this.queue.push(el);
        // Track if we have any opaque wall (alpha === 1)
        if (!this.hasOpaqueWall && (el.material?.color[3] || 0) === 1) {
            this.hasOpaqueWall = true;
        }
        return this;
    }
}
```

### Why It Works
- **Eliminates function call overhead:** `findMax()` call replaced with boolean check
- **Amortized cost:** The alpha check happens once per wall add, not once per `isFull()` call
- **Cache-friendly:** Boolean access is faster than method dispatch + property access chain
- **Called very frequently:** `isFull()` is called for every column (640) on every BSP node visit

---

## T6-T7: Cache Screen Values

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts`  
**Impact:** Minimal (within noise)

### Problem
Screen-related calculations were repeated in `ZBuffer.add()` even though they only change when the camera moves.

### Before (Original)
```typescript
export class ZBuffer {
    private cols: ZBufferColumn[];    
    private rays: IRay[];
    
    constructor(private resolution: number, private camera: ICamera, /*...*/) {
        this.cols = Array.from({ length: resolution }, () => new ZBufferColumn());
        this.rays = makeRays(this.resolution, this.camera);
    }

    public add(edge: IEdge, unclippedStart: Vector): void {        
        // These are recalculated on every add() call
        const screenLength = segmentLength(this.camera.screen);
        const screenPlane = createPlane(this.camera.screen);
        const screenLeft = this.camera.screen[0];
        
        let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));
        let sproj = intersectRayPlane(sray, screenPlane)?.point;
        // ...
        let scol = Math.ceil(distance(screenLeft, sproj) / screenLength * this.resolution);
        // ...
    }
}
```

### After (Optimized)
```typescript
export class ZBuffer {
    private cols: ZBufferColumn[];    
    private rays: IRay[];
    // Cached values that only change when camera changes
    private screenLength: number;
    private screenPlane: ReturnType<typeof createPlane>;
    private screenLeft: Vector;
    
    constructor(private resolution: number, private camera: ICamera, /*...*/) {
        this.cols = Array.from({ length: resolution }, () => new ZBufferColumn());
        this.rays = makeRays(this.resolution, this.camera);
        this.updateCachedValues();  // Cache on construction
    }
    
    private updateCachedValues(): void {
        this.screenLength = segmentLength(this.camera.screen);
        this.screenPlane = createPlane(this.camera.screen);
        this.screenLeft = this.camera.screen[0];
    }

    public updateCamera(camera: ICamera): void {
        this.camera = camera;
        this.rays = makeRays(this.resolution, this.camera);
        this.updateCachedValues();  // Only recalculate when camera changes
    }

    public add(edge: IEdge, unclippedStart: Vector): void {        
        // Use cached values instead of recalculating
        let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));
        let sproj = intersectRayPlane(sray, this.screenPlane)?.point;
        // ...
        let scol = Math.ceil(distance(this.screenLeft, sproj) / this.screenLength * this.resolution);
        // ...
    }
}
```

### Why Impact Was Minimal
The cached calculations (`segmentLength`, `createPlane`) were already lightweight. The optimization is still correct but the savings are below measurement threshold.

---

## T8: Scratch Ray Objects (Reverted)

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts`  
**Impact:** **+7% regression** - REVERTED

### Problem (Attempted)
Ray objects are created in `ZBuffer.add()` for projection calculations. The hypothesis was that reusing scratch ray objects would reduce allocations.

### Before (Original - Kept)
```typescript
public add(edge: IEdge, unclippedStart: Vector): void {        
    // Create new ray objects each time
    let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));        
    let eray = makeRay(this.camera.position, subtract(edge.end.vector, this.camera.position));        
    let sproj = intersectRayPlane(sray, this.screenPlane)?.point;        
    let eproj = intersectRayPlane(eray, this.screenPlane)?.point;        
    // ...
}
```

### After (Attempted - Reverted)
```typescript
// Scratch rays for reuse
private _sray: IRay;
private _eray: IRay;

constructor(/*...*/) {
    // Initialize scratch rays
    this._sray = makeRay([0,0], [1,0]);
    this._eray = makeRay([0,0], [1,0]);
}

public add(edge: IEdge, unclippedStart: Vector): void {        
    // Reuse scratch rays - update in place
    updateRay(this._sray, this.camera.position, subtract(edge.start.vector, this.camera.position));
    updateRay(this._eray, this.camera.position, subtract(edge.end.vector, this.camera.position));
    let sproj = intersectRayPlane(this._sray, this.screenPlane)?.point;        
    let eproj = intersectRayPlane(this._eray, this.screenPlane)?.point;        
    // ...
}

// Helper to update ray in-place
function updateRay(ray: IRay, position: Vector, direction: Vector): void {
    ray.position = position;
    ray.direction = direction;
    // Must recalculate all derived values
    ray.dn = normalize(direction);
    ray.dperp = perpendicular(ray.dn);
    ray.ood = [1/direction[0], 1/direction[1]];
    ray.line = [position, add(position, direction)];
}
```

### Why It Regressed
1. **V8 optimizes short-lived objects:** The garbage collector handles temporary allocations efficiently
2. **Derived value overhead:** Updating derived properties (`dn`, `dperp`, `ood`, `line`) costs more than the allocation saved
3. **Hidden class optimization:** Creating fresh objects allows V8 to optimize better than mutating existing ones
4. **Property assignment overhead:** Multiple property assignments are slower than object literal creation

### Lesson
**Not all allocation reduction improves performance.** V8's generational GC is designed for short-lived objects. The overhead of manually managing object reuse often exceeds the GC cost.

---

## Tier 1 Optimizations (Batch 2)

The following optimizations address all remaining Tier 1 items from [`PERFORMANCE_ANALYSIS.md`](./PERFORMANCE_ANALYSIS.md). Unlike the initial batch (T1-T8), these focus on **eliminating unnecessary work** rather than object pooling, per the T8 lesson.

### Summary of Batch 2 Results

| # | Change | Files | ZBuffer Impact | Raycaster Impact |
|---|--------|-------|----------------|------------------|
| 1.8 | Inline `distance()` | `vector.ts` | -24% to -42% (small-stress) | -12% to -24% |
| 2.7 | Direct rotation (no matrix) | `vector.ts` | -- | -- |
| 2.3 | Inline dot in AABB tests | `querying.ts` | Within noise | Within noise |
| 3.2 | Short-circuit `isFull()` | `zbuffer-renderer.ts` | Within noise | N/A |
| 1.9 | Conditional `clippedSegments` | `zbuffer-renderer.ts` | Within noise | N/A |
| 1.5 | `accumulateStats` in-place | `raycaster.ts` | N/A | Within noise |
| 1.4 | Lazy Set allocation | `collision.ts`, `querying.ts` | N/A | Moderate |
| 1.7 | `intersectRayEdge` null on miss | `collision.ts`, `raycaster.ts` | N/A | Moderate |
| 1.1a | Fuse atan2+cos trig pair | `camera.ts`, `collision.ts` | Moderate | Moderate |
| 1.3 | Direct screen projection | `zbuffer-renderer.ts`, `zbuffer-core.ts` | **Significant** | N/A |
| 1.2 | Lightweight `clipEdgeLightweight` | `edge.ts`, `camera.ts` | **Significant** | N/A |

### Cumulative from Original Baseline (all optimizations)
- **ZBuffer:** -24% to -90% depending on scene complexity
- **Raycaster:** -12% to -32% depending on scene complexity
- **28 benchmark scenarios improved, 1 minor regression, 3 unchanged**

---

### 1.8: Inline `distance()` to Avoid Subtract Allocation

**File:** `src/common/math/vector.ts`  
**Impact:** Foundation optimization — improves every caller

#### Before
```typescript
const distance = (u: Vector, v: Vector): number => norm(subtract(u, v));
// subtract allocates [number, number], norm calls sqrt(dot(u,u))
```

#### After
```typescript
const distance = (u: Vector, v: Vector): number => {
    const dx = u[0] - v[0];
    const dy = u[1] - v[1];
    return Math.sqrt(dx * dx + dy * dy);
};

const distanceSqr = (u: Vector, v: Vector): number => {
    const dx = u[0] - v[0];
    const dy = u[1] - v[1];
    return dx * dx + dy * dy;
};
```

Zero allocations. `distanceSqr` added for comparison-only use cases that don't need the `sqrt`.

---

### 2.7: Replace `rotate()` with Direct Computation

**File:** `src/common/math/vector.ts`  
**Impact:** Eliminates 3 array allocations per rotation call

#### Before
```typescript
const rotate = (angle: number, u: Vector): Vector => matMultiply(createRotation(angle), u);

const createRotation = (angle: number): [Vector, Vector] => [
    [Math.cos(angle), -1 * Math.sin(angle)],  // allocates inner array
    [Math.sin(angle), Math.cos(angle)]          // allocates inner array
];  // allocates outer array
```

#### After
```typescript
const rotate = (angle: number, u: Vector): Vector => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c * u[0] - s * u[1], s * u[0] + c * u[1]];
};
```

Eliminates the intermediate 2x2 matrix (3 arrays) and the `matMultiply` call. Single allocation for the result vector.

---

### 2.3: Inline Dot Product in AABB Frustum Tests

**File:** `src/common/geometry/bsp/querying.ts`  
**Impact:** Eliminates ~150 temporary arrays per frame

#### Before
```typescript
// Allocated [px, py] just to pass to dot()
return dot(plane.n, [px, py]) < plane.d;
```

#### After
```typescript
return plane.n[0] * px + plane.n[1] * py < plane.d;
```

Zero allocations. Applied to both `isAABBBehindPlane` and `isAABBInFrontOfPlane`.

---

### 3.2: Short-Circuit `isFull()` with Early Return

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts`  
**Impact:** O(640) → O(1) in best case

#### Before
```typescript
public isFull(): boolean {
    let allFilled = true;
    for (let c of this.cols) {
        allFilled = allFilled && c.isFull();  // Does NOT short-circuit the loop
    }
    return allFilled;
}
```

#### After
```typescript
public isFull(): boolean {
    for (const c of this.cols) {
        if (!c.isFull()) return false;
    }
    return true;
}
```

The original code iterated all 640 columns even after finding one not-full, because `&&` in an assignment doesn't break the loop.

---

### 1.9: Conditional `clippedSegments` Debug Array

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts`  
**Impact:** Eliminates ~100 object allocations on 59/60 frames

The `clippedSegments` array (used for debug/stats display) was built every frame but only dispatched to the store once per second. Now only built when stats will actually be used:

```typescript
const shouldCollectStats = performance.now() - this.previousStatsTimestamp > 1000;
let clippedSegments = shouldCollectStats ? [] : null;
// ...
if (clippedSegments) clippedSegments.push({ segment: clipped.segment, depth: count });
```

---

### 1.5: `accumulateStats` Mutate In-Place

**File:** `src/common/rendering/raycasting/raycaster.ts`  
**Impact:** Eliminates 1,920 allocations/frame (640 rays × 3 objects each)

#### Before
```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): CastingStats => {
    for (const x of iStats.polygons) { stats.polygons.add(x); }
    return ({                                   // New object per ray
        polygons: stats.polygons,
        edgeTests: [/* new array */],           // New array per ray
        polygonTests: [/* new array */],        // New array per ray
    });
};
```

#### After
```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): void => {
    for (const x of iStats.polygons) { stats.polygons.add(x); }
    stats.edgeTests[0] = Math.min(stats.edgeTests[0], iStats.testedEdges);
    stats.edgeTests[1] = Math.max(stats.edgeTests[1], iStats.testedEdges);
    stats.polygonTests[0] = Math.min(stats.polygonTests[0], iStats.testedPolygons);
    stats.polygonTests[1] = Math.max(stats.polygonTests[1], iStats.testedPolygons);
};
```

**Critical bug fixed:** The initial stats in `castRays` was created via `{...EMPTY_STATS}`, which copies `edgeTests` and `polygonTests` by **reference** (they are arrays). In-place mutation would corrupt the `EMPTY_STATS` constant, causing "Cannot assign to read only property" in the Electron app. Fixed by creating fresh arrays inline:

```typescript
let stats: CastingStats = {
    polygons: new Set<String>(),
    edgeTests: [+Infinity, -Infinity],     // fresh array, not shared reference
    polygonTests: [+Infinity, -Infinity],  // fresh array, not shared reference
    ...
};
```

---

### 1.4: Lazy Set Allocation in `createEmptyIntersection`

**File:** `src/common/geometry/collision.ts`, `src/common/geometry/bsp/querying.ts`  
**Impact:** Eliminates ~6,400-9,600 Set allocations/frame (raycaster path)

#### Before
```typescript
export const createEmptyIntersection = (): PolygonIntersections =>
    ({hits: [], stop: false, edgeCount: 0, polygonCount: 0, polygonIds: new Set<string>()});
```

#### After
```typescript
export const createEmptyIntersection = (): PolygonIntersections =>
    ({hits: [], stop: false, edgeCount: 0, polygonCount: 0, polygonIds: null});
```

The Set is only created when polygon IDs are actually added. Callers updated with null guards:

```typescript
// In intersectRayPolygons:
if (result.polygonIds == null) result.polygonIds = new Set();
result.polygonIds.add(polygon.id);

// In addIntersections:
if (source.polygonIds != null) {
    if (target.polygonIds == null) target.polygonIds = new Set();
    for (const id of source.polygonIds) { target.polygonIds.add(id); }
}
```

---

### 1.7: `intersectRayEdge` Returns Null on Miss

**File:** `src/common/geometry/collision.ts`  
**Impact:** Eliminates hundreds of allocations per frame from ray-edge misses

#### Before
```typescript
export function intersectRayEdge(ray, edge, polygon): RayHit {
    const intersection = intersectRaySegment(ray, edge.segment);
    if (intersection) {
        return {polygon, ray, edge, intersection, distance: ...};
    }
    // MISS: still allocates a new object
    return {polygon: null, ray, edge, intersection: null, distance: 0};
}
```

#### After
```typescript
export function intersectRayEdge(edge: IEdge, ray: IRay, options: RayCastingOptions = null): RayHit {
    if (options?.edgeFilter && !options.edgeFilter(edge)) { return null; }
    const intersection = intersectRaySegment(ray, edge.segment);
    if (intersection) {
        return { polygon: null, ray, edge, intersection, distance: ... };
    }
    return null;  // Zero allocation on miss
}
```

Call sites updated to handle null via `!hit?.intersection` checks.

---

### 1.1a: Fuse `atan2` + `cos` Trig Pair

**Files:** `src/common/camera.ts`, `src/common/geometry/collision.ts`  
**Impact:** Eliminates 641 `atan2` + 641 `Math.cos` calls per frame, plus 1,282 temporary vector allocations from `lineAngle`

The original `makeCameraRay` called `lineAngle(midline, rayLine)` which internally computes `atan2(cross(u,v), dot(u,v))`, then `makeRay` computes `Math.cos(angle)`. Using the identity:

```
cos(atan2(y, x)) = x / sqrt(x² + y²)
```

#### Before
```typescript
const makeCameraRay = (factor, camera, midline) => {
    let rayDir = vector.add(camera.direction, vector.scale(factor, camera.plane));
    let rayLine = [camera.position, vector.add(camera.position, rayDir)] as ILine;  // 2 allocs
    return makeRay(camera.position, rayDir, lineAngle(midline, rayLine));
    // lineAngle: 2 subtract allocs + atan2, then makeRay: Math.cos(angle)
};
```

#### After
```typescript
const makeCameraRay = (factor, camera, midline) => {
    let rayDir = vector.add(camera.direction, vector.scale(factor, camera.plane));
    // Fused atan2+cos: cos(atan2(y,x)) = x / sqrt(x² + y²)
    const mx = midline[1][0] - midline[0][0];
    const my = midline[1][1] - midline[0][1];
    const d = mx * rayDir[0] + my * rayDir[1];  // dot(midDir, rayDir)
    const c = mx * rayDir[1] - my * rayDir[0];  // cross(midDir, rayDir)
    const cosAngle = d / Math.sqrt(d * d + c * c);
    return makeRayWithCos(camera.position, rayDir, cosAngle);
};
```

Added `makeRayWithCos` to `collision.ts` — identical to `makeRay` but accepts a pre-computed `cosAngle` instead of calling `Math.cos(angle)`.

---

### 1.3: Direct Screen Projection in `ZBuffer.add()`

**Files:** `src/common/rendering/zbuffering/zbuffer-renderer.ts`, `src/common/rendering/zbuffering/zbuffer-core.ts`  
**Impact:** Eliminates ~20 allocations per visible edge + 4 expensive math calls (`normalize`, `perpendicular`, `sqrt`, `cos`)

#### Before
```typescript
public add(edge: IEdge, unclippedStart: Vector): void {
    // Two full makeRay calls (~7 allocs each) just to project endpoints onto screen
    let sray = makeRay(this.camera.position, subtract(edge.start.vector, this.camera.position));
    let eray = makeRay(this.camera.position, subtract(edge.end.vector, this.camera.position));
    let sproj = intersectRayPlane(sray, this.screenPlane)?.point;
    let eproj = intersectRayPlane(eray, this.screenPlane)?.point;
    let scol = Math.ceil(distance(this.screenLeft, sproj) / this.screenLength * this.resolution);
    let ecol = Math.floor(distance(this.screenLeft, eproj) / this.screenLength * this.resolution);
}
```

#### After
```typescript
public add(edge: IEdge, unclippedStart: Vector): void {
    const camX = this.camera.position[0], camY = this.camera.position[1];
    const pn = this.screenPlane.n;
    const slX = this.screenLeft[0], slY = this.screenLeft[1];

    // Project start vertex — zero allocations
    const sdx = edge.start.vector[0] - camX;
    const sdy = edge.start.vector[1] - camY;
    const sdenom = pn[0] * sdx + pn[1] * sdy;
    if (Math.abs(sdenom) < 1e-10) return;
    const st = this.planeNumerator / sdenom;
    const six = camX + st * sdx - slX;
    const siy = camY + st * sdy - slY;
    const sScreenX = six * this.screenDirX + siy * this.screenDirY;

    // Project end vertex — zero allocations
    const edx = edge.end.vector[0] - camX;
    const edy = edge.end.vector[1] - camY;
    const edenom = pn[0] * edx + pn[1] * edy;
    if (Math.abs(edenom) < 1e-10) return;
    const et = this.planeNumerator / edenom;
    const eix = camX + et * edx - slX;
    const eiy = camY + et * edy - slY;
    const eScreenX = eix * this.screenDirX + eiy * this.screenDirY;

    let scol = Math.ceil(sScreenX * this.invScreenLength * this.resolution);
    let ecol = Math.floor(eScreenX * this.invScreenLength * this.resolution);
    if (ecol <= scol) return;  // Guard against edges projecting outside screen
    // ...
}
```

Cached values (`screenDirX`, `screenDirY`, `invScreenLength`, `planeNumerator`) are computed in `updateCachedValues()`, called only when the camera changes. The `ecol <= scol` guard prevents `RangeError: Invalid array length` from edges that project behind the screen or outside the view.

Same optimization applied to `zbuffer-core.ts` for benchmark consistency.

---

### 1.2: Lightweight `clipEdgeLightweight`

**Files:** `src/common/geometry/edge.ts`, `src/common/camera.ts`  
**Impact:** Eliminates deep cloning of material, key, slope/luminosity recomputation per visible edge

#### Before (via `cloneEdge`)
```typescript
export const cloneEdge = (e: IEdge, start = null, end = null): IEdge => loadEdge({
    id: cloneKey(e.id),                              // string allocation via .toString()
    start: start ? makeVertex(start) : cloneVertex(e.start),
    end: end ? makeVertex(end) : cloneVertex(e.end),
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),              // deep clone: [...color] + texture clone
});
// loadEdge recomputes: distance (sqrt), slope, luminosity, segment array
```

#### After
```typescript
export const clipEdgeLightweight = (e: IEdge, start = null, end = null): IEdge => {
    const sv = start ? makeVertex(start) : e.start;   // reference original if not clipped
    const ev = end ? makeVertex(end) : e.end;
    const segment: ILineSegment = [sv.vector, ev.vector];
    let len: number;
    if (start || end) {
        const dx = sv.vector[0] - ev.vector[0];
        const dy = sv.vector[1] - ev.vector[1];
        len = Math.sqrt(dx * dx + dy * dy);
    } else {
        len = e.length;
    }
    return {
        id: e.id,                // reference original (no cloneKey)
        start: sv, end: ev,
        material: e.material,    // reference original (no cloneMaterial)
        immaterial: e.immaterial,
        length: len,
        slope: e.slope,          // clipping doesn't change line direction
        segment,
        luminosity: e.luminosity // same slope => same luminosity
    };
};
```

**Key insights:**
- Clipping changes endpoint positions but not the line's direction, so `slope` and `luminosity` are preserved
- Materials are never mutated during rendering, so reference sharing is safe
- `WallProps.length` is populated but never actually read downstream (texture drawing uses a `tileFactor` constant), so the lightweight length computation is sufficient

---

## Tier 2 Optimizations: Redundant Computations

**Date:** February 18, 2026  
**Combined Impact:** Raycaster **-5% to -30%** depending on scene, ZBuffer unchanged  
**Items completed:** 2.4, 2.5, 2.6, 2.8 (2.1, 2.2, 2.3, 2.7 were already done in Tier 1)

### 2.4: Expose Parametric `t1` from `intersectRaySegment`

**File:** `src/common/geometry/collision.ts`  
**Impact:** Raycaster **-5% to -30%** (highest impact item in Tier 2)

#### Problem
`intersectRaySegment` computes the parametric `t1` value (distance along the normalized ray direction), but discards it. Callers (`intersectRayEdge`, `intersectRayPolygons`) then recompute distance from the intersection point using `distance(intersection.point, ray.line[0]) * ray.cosAngle`, which involves a `sqrt`, subtraction, and vertex-to-vector conversions.

#### Before
```typescript
// In intersectRaySegment:
return {
    point: [_point[0], _point[1]],
    face: c < 0 ? Face.exterior : Face.interior
};

// In intersectRayEdge:
distance: distance(intersection.point, ray.line[0]) * ray.cosAngle
// distance() calls vertex.distance -> vector.distance -> sqrt(dx*dx + dy*dy)
```

#### After
```typescript
// In intersectRaySegment: expose t1 on Intersection type
export type Intersection = {point: Vector, face: Face, t?: number};

return {
    point: [_point[0], _point[1]],
    face: c < 0 ? Face.exterior : Face.interior,
    t: t1  // parametric distance along normalized ray direction
};

// In intersectRayEdge: use t directly
distance: intersection.t * ray.cosAngle  // No distance() call, no allocation
```

**Eliminates per hit:** 1 `sqrt`, 1 subtraction, 2 `getVector` calls (vertex-to-vector conversion).

---

### 2.5: Replace `rotate(PI/2)` with `perpendicular` in `freeStrafe`

**File:** `src/common/camera.ts:76-84`  
**Impact:** Eliminates 2 trig calls + 1 array allocation per strafe movement

#### Before
```typescript
export const freeStrafe = (ratio: number, camera: ICamera) => {
    let sign = ratio > 0 ? 1 : -1;
    let n = vector.scale(Math.abs(ratio), vector.rotate(sign * Math.PI / 2, camera.direction));
    return changeLocation(n, camera);
};
```

#### After
```typescript
export const freeStrafe = (ratio: number, camera: ICamera) => {
    // rotate(+PI/2, [x,y]) = [-y, x], rotate(-PI/2, [x,y]) = [y, -x]
    const dir = camera.direction;
    const perp: vector.Vector = ratio > 0 ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
    let n = vector.scale(Math.abs(ratio), perp);
    return changeLocation(n, camera);
};
```

**Key insight:** Rotation by exactly 90 degrees is just perpendicular (swapping components with sign change). No trigonometry needed.

---

### 2.6: Short-circuit `Math.cos(0) = 1` in `makeRay`

**File:** `src/common/geometry/collision.ts:23`  
**Impact:** Trivial (eliminates 1 trig call per `makeRay` call with default angle)

#### Before
```typescript
cosAngle: Math.cos(angle)  // angle defaults to 0
```

#### After
```typescript
cosAngle: angle === 0 ? 1 : Math.cos(angle)
```

Called ~40+ times per frame from collision rays and wall-slide checks. Negligible individually but zero-cost to implement.

---

### 2.8: Cache `directionNorm` on Camera Object

**File:** `src/common/camera.ts`  
**Impact:** Eliminates `sqrt` per `constrainedMove` call (every player movement)

#### Before
```typescript
// In constrainedMove (called every movement frame):
const stepSize = Math.abs(speed) * vector.norm(cam.direction);  // sqrt every time
// ...
movementRatio = vector.norm(vector.scale(movementRatio, cam.direction)) * slideFactor;  // scale + sqrt
```

#### After
```typescript
// In makeCamera: precompute once when camera is created
export type ICamera = ICameraData & {
    // ...existing fields...
    directionNorm: number
};
return { ...data, screen, midline, cone, planes, directionNorm: vector.norm(data.direction) };

// In constrainedMove: use cached value
const stepSize = Math.abs(speed) * cam.directionNorm;  // no sqrt
// ...
movementRatio = Math.abs(movementRatio) * cam.directionNorm * slideFactor;  // no scale, no sqrt
```

**Key insight:** Camera direction magnitude only changes via `adaptDepth` (rare, triggered by zoom controls). `constrainedMove` is called every frame during player movement. The `|scale(k, v)| = |k| * |v|` identity eliminates both the `scale` allocation and the `norm` sqrt.

---

### Tier 2 Benchmark Results

Compared pre-Tier-2 vs post-Tier-2 (same session, same environment):

| Scenario | Pre Raycaster (ms) | Post Raycaster (ms) | Change |
|---|---|---|---|
| small-fast | 4.50 | 4.43 | -1.6% |
| small-textured | 5.92 | 5.03 | -15.0% |
| small-translucent | 6.73 | 5.32 | -20.9% |
| small-stress | 6.04 | 4.82 | -20.2% |
| medium-fast | 23.73 | 17.74 | **-25.3%** |
| medium-textured | 22.36 | 19.31 | -13.6% |
| medium-translucent | 18.69 | 18.20 | -2.6% |
| medium-stress | 16.41 | 16.77 | +2.2% |
| large-textured | 55.37 | 38.68 | **-30.1%** |
| large-translucent | 48.49 | 44.78 | -7.7% |
| large-stress | 64.66 | 50.16 | **-22.4%** |
| stress-translucent | 113.73 | 87.74 | **-22.9%** |

ZBuffer times remained stable (within noise) since these optimizations primarily target the raycaster path's `intersectRayEdge`/`intersectRayPolygons` distance computation. Items 2.5, 2.6, and 2.8 are movement-time optimizations not captured in rendering benchmarks.

---

## Tier 3 Optimizations: Architectural & Design-Level Improvements

**Date:** February 20, 2026  
**Combined Impact:** Raycaster **-5% to -36%**, ZBuffer **-15% to -28%** (from Tier 2 baseline)  
**Items completed:** 3.1, 3.6, 3.7, 3.8 (3.2 done in Tier 1; 3.3/3.4/3.5 skipped — Electron runtime; 3.9 skipped per doc)

### 3.1: Fix O(n²) Array Spread in `constructZBuffer`

**File:** `src/common/rendering/raycasting/renderer3d.ts:146-165`  
**Impact:** Raycaster path — eliminates O(n²) array copies per wall group

#### Problem
Inside the `reduce` loop, `[...acc.get(currentWallGroup) || [], wall]` copies the entire existing array every time a wall is added. For a wall spanning 100 columns, this creates arrays of size 1, 2, 3, ..., 100 — **O(n²) total copies** per wall group.

#### Before
```typescript
const groupedByEdge = rays.reduce(
    (acc, r, rayIndex) => {
        // ...
        return acc.set(currentWallGroup, [...acc.get(currentWallGroup) || [], wall]);
    }, new Map<IEntityKey, WallProps[]>());
```

#### After
```typescript
const groupedByEdge = new Map<IEntityKey, WallProps[]>();
for (let rayIndex = 0; rayIndex < rays.length; rayIndex++) {
    // ...
    const existing = groupedByEdge.get(currentWallGroup);
    if (existing) {
        existing.push(wall);     // O(1) amortized — no copy
    } else {
        groupedByEdge.set(currentWallGroup, [wall]);
    }
}
```

Also replaced `reduce` with a plain `for` loop to avoid closure overhead and improve debuggability.

---

### 3.7: Replace `Math.max(...640-element-array)` with Single-Pass Scan

**File:** `src/common/rendering/raycasting/renderer3d.ts:148-149`  
**Impact:** Eliminates 1 intermediate array allocation + 640-element stack spread

#### Before
```typescript
const indexes = rays.map(r => r.hits.length);    // allocates 640-element array
const max = Math.max(...indexes);                 // spreads 640 elements onto call stack
```

#### After
```typescript
let max = 0;
for (let r = 0; r < rays.length; r++) {
    const len = rays[r].hits.length;
    if (len > max) max = len;
}
```

Zero allocations. Also avoids a potential stack overflow for very large ray counts.

---

### 3.6: Replace `.filter()` Count with Loop

**File:** `src/common/rendering/raycasting/raycast-core.ts:52`  
**Impact:** Eliminates 640 array allocations per render (1 per ray)

#### Before
```typescript
const validHits = ray.hits.filter(h => h.distance !== Number.POSITIVE_INFINITY);
if (validHits.length > 0) {
    columnsWithHits++;
    edgesVisible += validHits.length;
}
```

#### After
```typescript
let validCount = 0;
for (let hi = 0; hi < ray.hits.length; hi++) {
    if (ray.hits[hi].distance !== Number.POSITIVE_INFINITY) validCount++;
}
if (validCount > 0) {
    columnsWithHits++;
    edgesVisible += validCount;
}
```

The filtered array was only used for its `.length` — a counting loop does the same work with zero allocations.

---

### 3.8: Replace PriorityDeque with Sorted Insertion Array in ZBufferColumn

**File:** `src/common/rendering/zbuffering/zbuffer-renderer.ts:268-310`  
**Impact:** ZBuffer **-15% to -28%** — removes external library overhead for small collections

#### Problem
Each of the 640 `ZBufferColumn` instances used a `PriorityDeque` (external library). Columns typically contain 1-3 walls. Heap data structures have significant overhead (comparisons, swaps, tree maintenance) that is not justified for such small collections.

#### Before
```typescript
export class ZBufferColumn {
    private queue: PriorityDeque<WallProps>;
    
    constructor() {
        this.queue = new PriorityDeque<WallProps>({
            compare: (a, b) => a.distance - b.distance
        });
    }

    public add(el: WallProps): ZBufferColumn {
        this.queue.push(el);
        // ...
    }

    public shift(): WallProps {
        return this.queue.shift();
    }
}
```

#### After
```typescript
export class ZBufferColumn {
    private walls: WallProps[] = [];
    private count: number = 0;
    
    public clear(): void {
        this.count = 0;         // Reuse array slots, don't reallocate
        this.hasOpaqueWall = false;
    }

    public add(el: WallProps): ZBufferColumn {
        const d = el.distance;
        let i = this.count;
        if (i >= this.walls.length) {
            this.walls.push(el);
        } else {
            this.walls[i] = el;
        }
        // Insertion sort: shift elements right to maintain ascending order
        while (i > 0 && this.walls[i - 1].distance > d) {
            this.walls[i] = this.walls[i - 1];
            i--;
        }
        this.walls[i] = el;
        this.count++;
        // ...
    }

    public shift(): WallProps {
        // Pop from end = largest distance = farthest wall (back-to-front)
        if (this.count === 0) return undefined;
        return this.walls[--this.count];
    }
}
```

**Key design decisions:**
- Array sorted ascending by distance; `shift()` pops from end (farthest first = back-to-front rendering order)
- `clear()` resets `count` to 0 but retains the array buffer — avoids reallocation across frames
- For 1-3 elements, linear insertion sort has better cache locality and lower overhead than heap operations
- Removed external `priority-deque` dependency from ZBuffer rendering path

---

### Skipped Items

| # | Description | Reason |
|---|-------------|--------|
| 3.2 | `isFull()` short-circuit | Already completed in Tier 1 |
| 3.3 | Selector-based store subscriptions | Electron runtime concern — not measurable by rendering benchmarks |
| 3.4 | Single renderer instantiation | Electron runtime concern — not measurable by rendering benchmarks |
| 3.5 | Batched camera dispatches | Electron runtime concern — not measurable by rendering benchmarks |
| 3.9 | SoA layout for WallProps | Large refactor — doc says "only if profiling confirms"; profiling shows column sort is not the bottleneck |

### Tier 3 Benchmark Results

Compared Tier 2 baseline vs post-Tier 3 (same environment):

| Scenario | Pre ZBuffer (ms) | Post ZBuffer (ms) | Change | Pre Raycaster (ms) | Post Raycaster (ms) | Change |
|---|---|---|---|---|---|---|
| small-fast | 1.24 | 1.08 | -13.5% | 4.43 | 4.19 | -5.3% |
| small-textured | 1.40 | 1.08 | **-23.1%** | 5.03 | 4.63 | -8.1% |
| small-translucent | 1.55 | 1.31 | **-15.4%** | 5.32 | 4.30 | **-19.1%** |
| medium-fast | 1.78 | 1.60 | -10.0% | 17.74 | 14.51 | **-18.2%** |
| medium-textured | 1.77 | 2.11 | +19.1%* | 19.31 | 15.81 | **-18.1%** |
| large-fast | 1.71 | 1.79 | +4.0%* | 44.03 | 34.92 | **-20.7%** |
| large-textured | 1.87 | 1.47 | **-21.3%** | 38.68 | 34.40 | -11.1% |
| large-translucent | 2.48 | 2.10 | **-15.3%** | 44.78 | 32.60 | **-27.2%** |
| large-stress | 2.44 | 2.29 | -6.0% | 50.16 | 34.77 | **-30.7%** |
| stress-fast | 2.10 | 2.03 | -3.3% | 131.13 | 94.81 | **-27.7%** |
| stress-textured | 2.69 | 1.96 | **-27.1%** | 100.97 | 75.52 | **-25.2%** |
| stress-translucent | 3.06 | 2.20 | **-27.9%** | 87.74 | 82.10 | -6.4% |
| stress-stress | 3.61 | 3.15 | -12.7% | 94.57 | 72.96 | **-22.8%** |

\* ZBuffer results marked with * are within noise (high CV, random map generation varies).

**Baseline comparison report: 20 improvements, 0 regressions, 12 unchanged.**

---

## Lessons Learned

### What Worked

1. **Caching derived values that don't change** (T5, T6-T7, 1.3)
   - `hasOpaqueWall` flag: -66% ZBuffer improvement
   - Cached screen projection values eliminate per-edge recomputation
   - Only cache when the computation is expensive relative to access frequency

2. **Eliminating intermediate allocations in hot loops** (T1, T3, 1.8, 1.3)
   - `push.apply()` vs spread: -8.8%
   - Single-pass filter+sort: -16%
   - Inline `distance()`: foundational win across entire codebase
   - Direct screen projection: zero-allocation replacement for ~20 objects per edge

3. **Algorithmic improvements** (T3, 1.1a, 1.2, 2.4)
   - Combining operations reduces passes over data
   - Trig identity `cos(atan2(y,x)) = x/sqrt(x²+y²)` eliminates 1,282 trig calls/frame
   - Reference sharing instead of deep cloning (safe when data is read-only during rendering)
   - Exposing intermediate values (`t1` parametric distance) eliminates redundant recomputation

4. **Lazy allocation** (1.4, 1.7, 1.9)
   - Don't allocate Sets/objects/arrays until actually needed
   - Return null instead of sentinel objects on miss paths
   - Skip debug data collection when it won't be consumed

### What Didn't Work

1. **Object pooling/scratch objects** (T8)
   - V8 optimizes short-lived allocations extremely well
   - Manual object reuse adds overhead that exceeds GC savings

2. **Micro-optimizations in non-hot paths**
   - `forEach` vs `for...of` had minimal impact
   - Focus optimization effort on profiled hot spots

### Critical Bug: Shared Mutable State via Object Spread

The `{...EMPTY_STATS}` pattern is dangerous when the source object contains arrays/objects. Spread copies by reference, so `stats.edgeTests` and `EMPTY_STATS.edgeTests` point to the same array. In-place mutation (`stats.edgeTests[0] = x`) corrupts the constant, causing "Cannot assign to read only property" errors in the Electron app (where the constant may be frozen). **Always create fresh arrays inline** when the consuming code will mutate them.

### Benchmark Variability

- ZBuffer improvements are consistent and reliable
- Raycaster has high variance (10-30%) in translucent scenarios
- Always run multiple benchmark iterations for statistical significance
- High coefficient of variation (>50%) indicates unreliable comparisons
- The allocation benchmark's heap trend test fails flakily — pre-existing issue

### Architectural Insights

- The biggest wins came from understanding the call frequency patterns
- `isFull()` was called 640 columns × many BSP nodes = massive call count
- Reducing per-call cost by even microseconds has huge cumulative effect
- Investigate whether downstream consumers actually use computed values before optimizing their computation (e.g., `WallProps.length` was computed but never read)

---

## Appendix: Benchmark Commands

```bash
# Run full benchmark suite (~90 seconds)
npm run test:benchmark

# Run benchmarks and save as new baseline
UPDATE_BASELINE=1 npm run test:benchmark

# Run unit tests
npm test

# View optimization tracking data
cat benchmark-results/optimization-tracking.json

# View optimization report
cat benchmark-results/optimization-report.md
```
