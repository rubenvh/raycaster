# BSP Renderer Bug Fix

This document describes the bug found and fixed in the BSP-based Z-buffer renderer.

## Overview

The raycaster application uses a Binary Space Partitioning (BSP) tree for efficient rendering. A bug was causing walls to randomly not render from certain camera positions. The issue was in the Z-buffer early termination logic.

---

## Bug: Early Termination Based on Incorrect "Full" Detection

### Location
`src/common/rendering/zbuffering/zbuffer-renderer.ts` - lines 69-88

### Problem
The Z-buffer renderer used early termination during BSP traversal:

```typescript
// BEFORE (buggy)
walk(this.wallGeometry.bsp, this.camera.position, (ps => {
    for (let p of ps) {
        for (let e of p.edges) {
            // ... process edge ...
            buffer.add(clipped, e.start.vector);                    
            if (buffer.isFull()) return false;  // Early exit!
        }
    }    
    return !buffer.isFull();  // Stop traversal if full
}))
```

The fundamental assumption was that BSP traversal visits edges in front-to-back order (closest to camera first). **This assumption is incorrect.**

### Why BSP Walk Order != Distance Order

BSP trees partition space using splitting planes, but the traversal order doesn't guarantee distance ordering because:

1. **Coplanar edges can be at any distance** - edges on the splitting plane are stored in the `coplanar` array and visited between `nearest` and `farthest` subtrees
2. **Splitting plane selection is arbitrary** - the BSP was built for spatial partitioning, not for distance-based ordering

### Visualization

```
Camera at position C, looking at edges A, B, D

Top-down view:
                        
     D(dist=68)────────────────┐
                               │
     B(dist=40)────────────────┤ Splitting
                               │ Plane
     A(dist=24)────────────────┤
                               │
     ●C (camera)               │


BSP Structure (simplified):
                    [Root Split]
                         │
              ┌──────────┼──────────┐
              │          │          │
           nearest    coplanar   farthest
              │          │          │
           [empty]    [B,D]      [Leaf]
                      dist=      contains A
                      40,68      dist=24

BSP Walk Order:
  1. nearest (empty)
  2. coplanar → edges B,D (distances 40, 68) ← Processed FIRST!
  3. farthest → edge A (distance 24)        ← Processed LAST!

The Problem:
  - Edge B (opaque, dist=40) fills columns in Z-buffer
  - buffer.isFull() returns true
  - Edge A (dist=24) is NEVER processed, even though it's CLOSER!
```

### Fix

Remove early termination entirely - process ALL edges and let the Z-buffer's priority queue sort them by distance:

```typescript
// AFTER (fixed)
walk(this.wallGeometry.bsp, this.camera.position, (ps => {
    let increment = 0;
    for (let p of ps) {
        for (let e of p.edges) {
            if (e.material == null) continue;
            const clipped = clip(e, this.camera);
            if (clipped === NULL_EDGE) continue;

            // ... debug drawing ...

            edgesTested++;
            buffer.add(clipped, e.start.vector);
            // Note: removed early termination based on buffer.isFull() because BSP walk 
            // doesn't guarantee front-to-back distance ordering (coplanar edges can be 
            // at any distance). Must process all edges and let the ZBuffer sort by distance.
        }
    }    
    count = count + increment;
    return true;  // Always continue traversing
}))
```

The Z-buffer uses a `PriorityDeque` that sorts walls by distance, so rendering still happens in correct front-to-back order regardless of BSP traversal order.

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `zbuffer-renderer.ts` | 69-88 | Removed early termination based on `isFull()` |

---

## Test Cases

The bug was reproduced with map files where edges would randomly not render depending on camera position.

---

## Performance Considerations

Removing early termination means all visible edges are now processed, which could impact performance for complex scenes. Potential future optimizations:

1. **View frustum culling during BSP walk** - Skip entire subtrees that are outside the camera's view cone
2. **Distance-based BSP construction** - Build BSP with camera-aware splitting strategies
3. **Hybrid approach** - Use BSP for spatial queries but maintain a separate distance-sorted structure for rendering

For now, the correctness fix is more important than the performance optimization, and the Z-buffer's priority queue ensures correct rendering order.
