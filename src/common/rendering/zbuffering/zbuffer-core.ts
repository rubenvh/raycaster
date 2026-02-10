/**
 * Pure ZBuffer rendering core for benchmarking.
 * 
 * Extracts the computational work from ZBufferRenderer without DOM or Redux dependencies.
 * This allows benchmarking the BSP walk + edge visibility determination in isolation.
 */

import { IGeometry } from '../../geometry/geometry';
import { ICamera, clip, makeRays } from '../../camera';
import { walk } from '../../geometry/bsp/querying';
import { IEdge, NULL_EDGE } from '../../geometry/edge';
import { IRay, makeRay, intersectRayPlane } from '../../geometry/collision';
import { subtract, Vector } from '../../math/vector';
import { createPlane } from '../../math/plane';
import { distance } from '../../geometry/vertex';
import { segmentLength } from '../../math/lineSegment';
import { castRaysOnEdge } from '../raycasting/raycaster';
import { getMaterial } from '../../geometry/properties';
import { RenderMetrics } from '../benchmark-types';
import { IRendererCore, RenderResult } from '../renderer-core';
import { PriorityDeque } from 'priority-deque';

/**
 * Simplified wall data for benchmarking (no drawing-specific fields).
 */
interface BenchmarkWallEntry {
  edgeId: string;
  distance: number;
  alpha: number;
}

/**
 * Simplified ZBuffer column for benchmarking.
 */
class BenchmarkZBufferColumn {
  private queue: PriorityDeque<BenchmarkWallEntry>;
  
  constructor() {
    this.queue = new PriorityDeque<BenchmarkWallEntry>({ 
      compare: (a, b) => a.distance - b.distance 
    });
  }

  get length(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.queue.length > 0 && this.queue.findMax().alpha === 1;
  }
  
  add(entry: BenchmarkWallEntry): void {
    this.queue.push(entry);
  }

  shift(): BenchmarkWallEntry | undefined {
    return this.queue.shift();
  }
}

/**
 * Pure ZBuffer renderer core implementing IRendererCore.
 * 
 * Performs BSP walk and visibility determination without actual drawing.
 */
export class ZBufferCore implements IRendererCore {
  readonly name = 'ZBuffer (BSP)';
  readonly requiresBsp = true;

  render(geometry: IGeometry, camera: ICamera, resolution: number): RenderResult {
    const startTime = performance.now();
    
    let edgesTested = 0;
    let edgesVisible = 0;
    
    // Create rays for the resolution
    const rays = makeRays(resolution, camera);
    
    // Create column buffers
    const cols: BenchmarkZBufferColumn[] = Array.from(
      { length: resolution }, 
      () => new BenchmarkZBufferColumn()
    );
    
    // Walk BSP tree and collect visible edges
    if (geometry.bsp) {
      walk(geometry.bsp, camera.position, (polygons) => {
        for (const p of polygons) {
          for (const e of p.edges) {
            // Skip edges with no material
            if (e.material == null) continue;
            
            // Clip to camera frustum
            const clipped = clip(e, camera);
            if (clipped === NULL_EDGE) continue;
            
            edgesTested++;
            
            // Project edge to screen columns and add to zbuffer
            const added = this.addEdgeToBuffer(
              clipped, 
              e.start.vector, 
              camera, 
              rays, 
              cols, 
              resolution
            );
            
            if (added > 0) {
              edgesVisible++;
            }
          }
        }
        
        // Check if buffer is full (all columns have opaque front wall)
        return !this.isBufferFull(cols);
      });
    }
    
    // Count total columns that have content
    let columnsWithContent = 0;
    for (const col of cols) {
      if (col.length > 0) {
        columnsWithContent++;
      }
    }
    
    const endTime = performance.now();
    
    return {
      metrics: {
        renderTimeMs: endTime - startTime,
        edgesTested,
        edgesVisible,
        columnsProcessed: columnsWithContent,
      },
    };
  }
  
  /**
   * Add an edge to the zbuffer columns.
   * Returns the number of columns the edge was added to.
   */
  private addEdgeToBuffer(
    edge: IEdge,
    unclippedStart: Vector,
    camera: ICamera,
    rays: IRay[],
    cols: BenchmarkZBufferColumn[],
    resolution: number
  ): number {
    // Project edge endpoints to screen
    const sray = makeRay(camera.position, subtract(edge.start.vector, camera.position));
    const eray = makeRay(camera.position, subtract(edge.end.vector, camera.position));
    const sproj = intersectRayPlane(sray, createPlane(camera.screen))?.point;
    const eproj = intersectRayPlane(eray, createPlane(camera.screen))?.point;
    
    if (!sproj || !eproj) return 0;
    
    // Calculate screen columns
    const [pl] = camera.screen;
    const screenLength = segmentLength(camera.screen);
    let scol = Math.ceil(distance(pl, sproj) / screenLength * resolution);
    let ecol = Math.floor(distance(pl, eproj) / screenLength * resolution);
    
    [scol, ecol] = [
      Math.max(0, Math.min(scol, ecol) - 1), 
      Math.min(resolution, Math.max(scol, ecol) + 1)
    ];
    
    // Cast rays on edge
    const raySlice = rays.slice(scol, ecol);
    const hits = castRaysOnEdge(raySlice, edge);
    
    let addedCount = 0;
    for (let i = 0; i < hits.length; i++) {
      if (hits[i].intersection === null) continue;
      
      const material = getMaterial(hits[i].intersection.face, edge.material);
      const alpha = material?.color[3] ?? 0;
      if (alpha === 0) continue;
      
      const colIndex = scol + i;
      if (colIndex >= 0 && colIndex < resolution) {
        cols[colIndex].add({
          edgeId: edge.id?.toString() ?? '',
          distance: hits[i].distance,
          alpha,
        });
        addedCount++;
      }
    }
    
    return addedCount;
  }
  
  private isBufferFull(cols: BenchmarkZBufferColumn[]): boolean {
    for (const col of cols) {
      if (!col.isFull()) return false;
    }
    return true;
  }
}
