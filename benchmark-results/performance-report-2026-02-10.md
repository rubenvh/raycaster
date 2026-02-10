# Rendering Performance Report

**Date:** 2026-02-10  
**Test Environment:** Windows, Jest benchmark suite  
**Resolution:** 640px  
**Frames per test:** 100  

## Summary: BSP vs Traditional Raycasting

| Map Size | Material | ZBuffer (BSP) | Raycaster | Speedup | Edges (BSP vs Ray) |
|----------|----------|---------------|-----------|---------|-------------------|
| Small (50 poly) | fast | 1.87ms | 6.53ms | 3.5x | 72 vs 130,764 |
| Small (50 poly) | textured | 1.74ms | 6.28ms | 3.6x | 67 vs 128,200 |
| Small (50 poly) | translucent | 2.64ms | 7.08ms | 2.7x | 123 vs 128,200 |
| Small (50 poly) | stress | 1.77ms | 6.30ms | 3.6x | 117 vs 128,200 |
| Medium (200 poly) | fast | 3.87ms | 23.14ms | 6.0x | 151 vs 515,364 |
| Medium (200 poly) | textured | 2.76ms | 22.78ms | 8.3x | 111 vs 512,800 |
| Medium (200 poly) | translucent | 6.48ms | 21.82ms | 3.4x | 419 vs 515,364 |
| Medium (200 poly) | stress | 6.83ms | 23.89ms | 3.5x | 421 vs 515,364 |
| Large (500 poly) | fast | 3.46ms | 64.07ms | 18.5x | 86 vs 1,153,800 |
| Large (500 poly) | textured | 3.09ms | 60.89ms | 19.7x | 75 vs 1,153,800 |
| Large (500 poly) | translucent | 14.41ms | 66.67ms | 4.6x | 759 vs 1,153,800 |
| Large (500 poly) | stress | 14.38ms | 68.83ms | 4.8x | 745 vs 1,153,800 |
| Stress (1000 poly) | fast | 4.45ms | 134.61ms | 30.2x | 107 vs 2,307,600 |
| Stress (1000 poly) | textured | 6.09ms | 127.51ms | 20.9x | 108 vs 2,307,600 |
| Stress (1000 poly) | translucent | 33.15ms | 137.69ms | 4.2x | 1,427 vs 2,307,600 |
| Stress (1000 poly) | stress | 31.81ms | 135.18ms | 4.2x | 1,557 vs 2,307,600 |

## Key Findings

### 1. BSP Speedup by Map Size

| Map Size | Average Speedup |
|----------|-----------------|
| Small (50 poly) | 3.4x |
| Medium (200 poly) | 5.3x |
| Large (500 poly) | 11.9x |
| Stress (1000 poly) | 14.9x |

The BSP tree provides increasingly better performance as geometry complexity increases because it effectively culls invisible geometry.

### 2. Edge Testing Efficiency

- **Raycaster:** Tests every edge for every ray - O(edges × rays)
  - Stress map: ~2.3 million edge tests per frame
- **BSP:** Only tests edges in visible regions - O(visible edges)
  - Stress map: ~100-1,500 edge tests per frame
- **Result:** 99.9% fewer edge tests with BSP

### 3. Frame Rate Performance

| Map Size | BSP fps | Raycaster fps | BSP meets 60fps? |
|----------|---------|---------------|------------------|
| Small | 535-575 | 141-159 | Yes |
| Medium | 146-362 | 42-46 | Yes |
| Large | 69-324 | 15-16 | Mostly |
| Stress | 30-225 | 7-8 | Varies |

### 4. Translucent Material Overhead

The BSP renderer shows higher overhead with translucent materials because:
- Cannot early-terminate when hitting translucent surfaces
- Must process more edges through the ZBuffer
- Still 3-5x faster than raycaster in these scenarios

## Conclusion

The **BSP-based ZBuffer renderer** provides substantial performance improvements over traditional raycasting:

- **10-30x faster** rendering for opaque geometry on large maps
- **3-5x faster** even with translucent materials
- **99.9% fewer edge tests** due to spatial partitioning
- Better scalability as map complexity increases

The traditional raycaster struggles to maintain 60fps even on medium-sized maps, while the BSP renderer maintains good frame rates up to large maps with standard materials.

---

*Raw benchmark data: `rendering-metrics.json`*
