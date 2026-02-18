/**
 * Pure ZBuffer rendering core for benchmarking.
 * 
 * Extracts the computational work from ZBufferRenderer without DOM or Redux dependencies.
 * This allows benchmarking the BSP walk + edge visibility determination in isolation.
 */

import { IGeometry } from '../../geometry/geometry';
import { ICamera, clip, makeRays } from '../../camera';
import { walk, walkWithFrustum } from '../../geometry/bsp/querying';
import { IEdge, NULL_EDGE } from '../../geometry/edge';
import { IRay } from '../../geometry/collision';
import { Vector } from '../../math/vector';
import { createPlane, Plane } from '../../math/plane';
import { segmentLength } from '../../math/lineSegment';
import { castRaysOnEdgeRange } from '../raycasting/raycaster';
import { getMaterial } from '../../geometry/properties';
import { RenderMetrics } from '../benchmark-types';
import { ColumnHit, IRendererCore, RenderResult } from '../renderer-core';
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
  private hasOpaqueWall: boolean = false;  // Track if any wall has alpha === 1
  
  constructor() {
    this.queue = new PriorityDeque<BenchmarkWallEntry>({ 
      compare: (a, b) => a.distance - b.distance 
    });
  }

  get length(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.hasOpaqueWall;
  }
  
  add(entry: BenchmarkWallEntry): void {
    this.queue.push(entry);
    // Track if we have any opaque wall (alpha === 1)
    if (!this.hasOpaqueWall && entry.alpha === 1) {
      this.hasOpaqueWall = true;
    }
  }

  shift(): BenchmarkWallEntry | undefined {
    return this.queue.shift();
  }

  /**
   * Drain all entries from the column in distance-sorted order (closest first).
   */
  drain(): BenchmarkWallEntry[] {
    const entries: BenchmarkWallEntry[] = [];
    while (this.queue.length > 0) {
      entries.push(this.queue.shift()!);
    }
    return entries;
  }
  
  clear(): void {
    this.queue.clear();
    this.hasOpaqueWall = false;
  }
}

/**
 * Pure ZBuffer renderer core implementing IRendererCore.
 * 
 * Performs BSP walk and visibility determination without actual drawing.
 * Supports buffer reuse mode (Task 4 optimization) for reduced allocations.
 */
export class ZBufferCore implements IRendererCore {
  readonly name = 'ZBuffer (BSP)';
  readonly requiresBsp = true;
  
  // Reusable buffers (only used when reuseBuffers is true)
  private cols: BenchmarkZBufferColumn[] | null = null;
  private rays: IRay[] | null = null;
  private lastResolution: number = 0;
  
  // Cached projection values for direct screen projection (optimization 1.3)
  private screenDirX: number = 0;
  private screenDirY: number = 0;
  private invScreenLength: number = 0;
  private planeNumerator: number = 0;
  private screenPlane: Plane | null = null;
  private screenLeftX: number = 0;
  private screenLeftY: number = 0;
  
  /**
   * @param reuseBuffers - If true, reuses internal buffers between renders (Task 4 optimization)
   * @param captureHits - If true, includes per-column hit data in the result for comparison testing
   * @param useFrustumCulling - If true, uses walkWithFrustum for BSP traversal; if false, uses walk (default: true)
   */
  constructor(
    private reuseBuffers: boolean = false, 
    private captureHits: boolean = false,
    private useFrustumCulling: boolean = true,
  ) {}

  private updateCachedProjection(camera: ICamera): void {
    const screenLength = segmentLength(camera.screen);
    this.screenPlane = createPlane(camera.screen);
    this.screenLeftX = camera.screen[0][0];
    this.screenLeftY = camera.screen[0][1];
    const sx = camera.screen[1][0] - camera.screen[0][0];
    const sy = camera.screen[1][1] - camera.screen[0][1];
    this.screenDirX = sx / screenLength;
    this.screenDirY = sy / screenLength;
    this.invScreenLength = 1 / screenLength;
    const p = this.screenPlane;
    this.planeNumerator = p.d - (p.n[0] * camera.position[0] + p.n[1] * camera.position[1]);
  }

  render(geometry: IGeometry, camera: ICamera, resolution: number): RenderResult {
    const startTime = performance.now();
    
    let edgesTested = 0;
    let edgesVisible = 0;
    
    // Update cached projection values for this camera
    this.updateCachedProjection(camera);
    
    // Get or create rays
    let rays: IRay[];
    if (this.reuseBuffers) {
      if (!this.rays || this.lastResolution !== resolution) {
        this.rays = makeRays(resolution, camera);
        this.lastResolution = resolution;
      } else {
        // Update rays for new camera position
        this.rays = makeRays(resolution, camera);
      }
      rays = this.rays;
    } else {
      rays = makeRays(resolution, camera);
    }
    
    // Get or create column buffers
    let cols: BenchmarkZBufferColumn[];
    if (this.reuseBuffers) {
      if (!this.cols || this.cols.length !== resolution) {
        this.cols = Array.from(
          { length: resolution }, 
          () => new BenchmarkZBufferColumn()
        );
      } else {
        // Clear existing columns for reuse
        for (const col of this.cols) {
          col.clear();
        }
      }
      cols = this.cols;
    } else {
      cols = Array.from(
        { length: resolution }, 
        () => new BenchmarkZBufferColumn()
      );
    }
    
    // Walk BSP tree and collect visible edges
    if (geometry.bsp) {
      const processPolygons = (polygons: import('../../geometry/polygon').IPolygon[]) => {
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
      };

      if (this.useFrustumCulling) {
        walkWithFrustum(geometry.bsp, camera.position, camera.planes, processPolygons);
      } else {
        walk(geometry.bsp, camera.position, processPolygons);
      }
    }
    
    // Count total columns that have content
    let columnsWithContent = 0;
    for (const col of cols) {
      if (col.length > 0) {
        columnsWithContent++;
      }
    }
    
    const endTime = performance.now();
    
    const result: RenderResult = {
      metrics: {
        renderTimeMs: endTime - startTime,
        edgesTested,
        edgesVisible,
        columnsProcessed: columnsWithContent,
      },
    };
    
    // Capture per-column hit data if requested
    if (this.captureHits) {
      const columnHits: ColumnHit[][] = [];
      for (const col of cols) {
        const entries = col.drain();
        columnHits.push(entries.map(e => ({
          edgeId: e.edgeId,
          distance: e.distance,
          alpha: e.alpha,
        })));
      }
      result.columnHits = columnHits;
    }
    
    return result;
  }
  
  /**
   * Add an edge to the zbuffer columns using direct screen projection (optimization 1.3).
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
    // Direct screen projection: project edge endpoints onto screen without constructing IRay objects
    const camX = camera.position[0];
    const camY = camera.position[1];
    const pn = this.screenPlane!.n;
    
    // Project start vertex
    const sdx = edge.start.vector[0] - camX;
    const sdy = edge.start.vector[1] - camY;
    const sdenom = pn[0] * sdx + pn[1] * sdy;
    if (Math.abs(sdenom) < 1e-10) return 0;
    const st = this.planeNumerator / sdenom;
    const six = camX + st * sdx - this.screenLeftX;
    const siy = camY + st * sdy - this.screenLeftY;
    const sScreenX = six * this.screenDirX + siy * this.screenDirY;
    
    // Project end vertex
    const edx = edge.end.vector[0] - camX;
    const edy = edge.end.vector[1] - camY;
    const edenom = pn[0] * edx + pn[1] * edy;
    if (Math.abs(edenom) < 1e-10) return 0;
    const et = this.planeNumerator / edenom;
    const eix = camX + et * edx - this.screenLeftX;
    const eiy = camY + et * edy - this.screenLeftY;
    const eScreenX = eix * this.screenDirX + eiy * this.screenDirY;
    
    let scol = Math.ceil(sScreenX * this.invScreenLength * resolution);
    let ecol = Math.floor(eScreenX * this.invScreenLength * resolution);
    
    [scol, ecol] = [
      Math.max(0, Math.min(scol, ecol) - 1), 
      Math.min(resolution, Math.max(scol, ecol) + 1)
    ];
    
    if (ecol <= scol) return 0;
    
    // Cast rays on edge range (avoids array slice allocation)
    const hits = castRaysOnEdgeRange(rays, scol, ecol, edge);
    
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
