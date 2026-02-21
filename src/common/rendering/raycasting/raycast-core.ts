/**
 * Pure raycasting renderer core for benchmarking.
 * 
 * Extracts the computational work from Renderer3d without DOM or Redux dependencies.
 * This allows benchmarking the traditional raycasting approach in isolation.
 */

import { IGeometry } from '../../geometry/geometry';
import { ICamera, makeRays } from '../../camera';
import { IBSPNode } from '../../geometry/bsp/model';
import { RenderMetrics } from '../benchmark-types';
import { ColumnHit, IRendererCore, RenderResult } from '../renderer-core';
import { castCollisionRays, CastedRays } from './raycaster';
import { getMaterial } from '../../geometry/properties';

/**
 * Pure raycasting renderer core implementing IRendererCore.
 * 
 * Performs ray casting for each screen column without actual drawing.
 * Works with or without BSP (falls back to brute-force polygon intersection).
 */
export class RaycastCore implements IRendererCore {
  readonly name = 'Raycaster';
  readonly requiresBsp = false;

  /**
   * @param captureHits - If true, includes per-column hit data in the result for comparison testing
   */
  constructor(private captureHits: boolean = false) {}

  render(geometry: IGeometry, camera: ICamera, resolution: number, bsp?: IBSPNode | null): RenderResult {
    const startTime = performance.now();
    
    // Generate rays for each screen column
    const rays = makeRays(resolution, camera);
    
    // Cast all rays against geometry
    const castedRays: CastedRays = castCollisionRays(rays, geometry, bsp);
    
    // Calculate metrics from results
    let edgesTested = 0;
    let edgesVisible = 0;
    let columnsWithHits = 0;
    
    // Optionally capture per-column hit data
    let columnHits: ColumnHit[][] | undefined;
    if (this.captureHits) {
      columnHits = [];
    }
    
    for (const ray of castedRays.castedRays) {
      // T3.6: Count hits without allocating a filtered array
      let validCount = 0;
      for (let hi = 0; hi < ray.hits.length; hi++) {
        if (ray.hits[hi].distance !== Number.POSITIVE_INFINITY) validCount++;
      }
      if (validCount > 0) {
        columnsWithHits++;
        edgesVisible += validCount;
      }
      
      // Capture column hit data if requested
      if (this.captureHits) {
        const hits: ColumnHit[] = [];
        for (const hit of ray.hits) {
          if (hit.distance === Number.POSITIVE_INFINITY || hit.intersection == null || hit.edge == null) continue;
          const material = getMaterial(hit.intersection.face, hit.edge.material);
          const alpha = material?.color[3] ?? 0;
          if (alpha === 0) continue;
          hits.push({
            edgeId: hit.edge.id?.toString() ?? '',
            distance: hit.distance,
            alpha,
          });
        }
        columnHits.push(hits);
      }
    }
    
    // Use stats from raycaster if available
    if (castedRays.stats) {
      // edgeTests is [min, max] across all rays
      edgesTested = castedRays.stats.edgeTests[1] * castedRays.castedRays.length;
    }
    
    const endTime = performance.now();
    
    const result: RenderResult = {
      metrics: {
        renderTimeMs: endTime - startTime,
        edgesTested,
        edgesVisible,
        columnsProcessed: columnsWithHits,
      },
    };
    
    if (this.captureHits) {
      result.columnHits = columnHits;
    }
    
    return result;
  }
}
