/**
 * Unified interface for renderer cores used in benchmarking.
 * 
 * This abstraction allows benchmarks to test different rendering strategies
 * (BSP-based ZBuffer, traditional raycasting) with the same test code.
 */

import { IGeometry } from '../geometry/geometry';
import { ICamera } from '../camera';
import { RenderMetrics } from './benchmark-types';

/**
 * Result returned by a renderer core after processing a frame.
 */
export interface RenderResult {
  /** Performance metrics for this frame */
  metrics: RenderMetrics;
}

/**
 * Interface for renderer cores that can be benchmarked.
 * 
 * Implementations should be pure and not depend on Redux store or DOM canvas.
 * They perform the computational work of rendering (visibility determination,
 * ray casting, etc.) but don't actually draw pixels.
 */
export interface IRendererCore {
  /** Human-readable name for this renderer */
  readonly name: string;
  
  /** Whether this renderer requires BSP tree in geometry */
  readonly requiresBsp: boolean;
  
  /**
   * Process a single frame of rendering.
   * 
   * @param geometry - The world geometry to render
   * @param camera - The camera viewpoint
   * @param resolution - Screen width in pixels (columns)
   * @returns Metrics about the rendering work performed
   */
  render(geometry: IGeometry, camera: ICamera, resolution: number): RenderResult;
}
