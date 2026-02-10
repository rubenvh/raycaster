/**
 * Pure raycasting renderer core for benchmarking.
 * 
 * Extracts the computational work from Renderer3d without DOM or Redux dependencies.
 * This allows benchmarking the traditional raycasting approach in isolation.
 */

import { IGeometry } from '../../geometry/geometry';
import { ICamera, makeRays } from '../../camera';
import { RenderMetrics } from '../benchmark-types';
import { IRendererCore, RenderResult } from '../renderer-core';
import { castCollisionRays, CastedRays } from './raycaster';

/**
 * Pure raycasting renderer core implementing IRendererCore.
 * 
 * Performs ray casting for each screen column without actual drawing.
 * Works with or without BSP (falls back to brute-force polygon intersection).
 */
export class RaycastCore implements IRendererCore {
  readonly name = 'Raycaster';
  readonly requiresBsp = false;

  render(geometry: IGeometry, camera: ICamera, resolution: number): RenderResult {
    const startTime = performance.now();
    
    // Generate rays for each screen column
    const rays = makeRays(resolution, camera);
    
    // Cast all rays against geometry
    const castedRays: CastedRays = castCollisionRays(rays, geometry);
    
    // Calculate metrics from results
    let edgesTested = 0;
    let edgesVisible = 0;
    let columnsWithHits = 0;
    
    for (const ray of castedRays.castedRays) {
      // Count hits that aren't at infinity
      const validHits = ray.hits.filter(h => h.distance !== Number.POSITIVE_INFINITY);
      if (validHits.length > 0) {
        columnsWithHits++;
        edgesVisible += validHits.length;
      }
    }
    
    // Use stats from raycaster if available
    if (castedRays.stats) {
      // edgeTests is [min, max] across all rays
      edgesTested = castedRays.stats.edgeTests[1] * castedRays.castedRays.length;
    }
    
    const endTime = performance.now();
    
    return {
      metrics: {
        renderTimeMs: endTime - startTime,
        edgesTested,
        edgesVisible,
        columnsProcessed: columnsWithHits,
      },
    };
  }
}
