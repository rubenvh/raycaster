/**
 * Shared types for rendering performance benchmarks.
 */

/**
 * Metrics collected for a single rendered frame.
 */
export interface RenderMetrics {
  /** Time spent on the main rendering work (zbuffer construction or raycasting) in ms */
  renderTimeMs: number;
  /** Number of edges tested/processed */
  edgesTested: number;
  /** Number of edges that passed visibility tests and were added to the buffer */
  edgesVisible: number;
  /** Number of screen columns processed */
  columnsProcessed: number;
}

/**
 * Result of a single benchmark run (one map + one renderer + multiple frames).
 */
export interface BenchmarkResult {
  /** ISO timestamp when this result was generated */
  timestamp: string;
  /** Configuration used for this benchmark run */
  config: {
    /** Descriptive name for this test case */
    mapName: string;
    /** Number of polygons in the test geometry */
    polygonCount: number;
    /** Total number of edges in the test geometry */
    edgeCount: number;
    /** Screen resolution (width in pixels) */
    resolution: number;
    /** Number of frames rendered */
    frameCount: number;
    /** Renderer used */
    renderer: string;
    /** Material preset used */
    materialPreset: string;
  };
  /** Aggregated metrics across all frames */
  metrics: {
    /** Average frame time in ms */
    avgFrameTimeMs: number;
    /** Minimum frame time in ms */
    minFrameTimeMs: number;
    /** Maximum frame time in ms */
    maxFrameTimeMs: number;
    /** 95th percentile frame time in ms */
    p95FrameTimeMs: number;
    /** Average number of edges tested per frame */
    avgEdgesTested: number;
    /** Average number of visible edges per frame */
    avgEdgesVisible: number;
  };
  /** Per-frame metrics for detailed analysis */
  frames: RenderMetrics[];
}

/**
 * Complete benchmark report containing all results from a run.
 */
export interface BenchmarkReport {
  /** ISO timestamp when the benchmark was run */
  runDate: string;
  /** Git commit hash if available */
  gitCommit?: string;
  /** All benchmark results */
  results: BenchmarkResult[];
}
