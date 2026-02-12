/**
 * Rendering Performance Benchmark Tests
 * 
 * Tests the performance of both rendering pipelines (ZBuffer/BSP and traditional
 * raycasting) against procedurally generated maps of varying complexity.
 * 
 * Run with: npm test -- --testPathPattern=benchmark
 * 
 * To save current results as baseline:
 *   npm test -- --testPathPattern=benchmark --updateBaseline
 * 
 * Results are written to benchmark-results/rendering-metrics.json
 * Baseline is stored in benchmark-results/baseline.json
 */

import 'jest-canvas-mock';
import * as fs from 'fs';
import * as path from 'path';

import { loadGeometry, IGeometry } from '../geometry/geometry';
import { buildBspTree } from '../geometry/bsp/creation';
import { IRendererCore } from './renderer-core';
import { ZBufferCore } from './zbuffering/zbuffer-core';
import { RaycastCore } from './raycasting/raycast-core';
import { BenchmarkResult, BenchmarkReport, RenderMetrics } from './benchmark-types';
import { 
  generateComplexMap, 
  MapGeneratorConfig, 
  DEFAULT_MAP_CONFIG,
  MATERIAL_PRESETS,
  MaterialPreset 
} from '../testing/map-generator';
import { 
  generateCameraPath, 
  getCameraAtFrame, 
  CameraPath 
} from '../testing/camera-path';
import { loadTextureSources } from '../testing/texture-loader';
import {
  compareToBaseline,
  formatComparisonReport,
  loadBaseline,
  saveBaseline,
} from './benchmark-comparison';

// ============================================================================
// Configuration
// ============================================================================

/** Output directory for benchmark results */
const RESULTS_DIR = path.join(__dirname, '../../../benchmark-results');
/** Output file for benchmark metrics */
const RESULTS_FILE = path.join(RESULTS_DIR, 'rendering-metrics.json');
/** Baseline file for comparison */
const BASELINE_FILE = path.join(RESULTS_DIR, 'baseline.json');
/** Check if UPDATE_BASELINE env var is set (use: UPDATE_BASELINE=1 npm run test:benchmark) */
const UPDATE_BASELINE = process.env.UPDATE_BASELINE === '1' || process.env.UPDATE_BASELINE === 'true';

/** Map size configurations */
const SIZE_CONFIGS = [
  { name: 'small', polygons: 50 },
  { name: 'medium', polygons: 200 },
  { name: 'large', polygons: 500 },
  { name: 'stress', polygons: 1000 },
] as const;

/** Material presets to test */
const MATERIAL_CONFIGS: MaterialPreset[] = ['fast', 'textured', 'translucent', 'stress'];

/** Number of frames to render per test */
const FRAME_COUNT = 100;

/** Number of warmup frames to exclude from statistical analysis */
const WARMUP_FRAMES = 10;

/** Screen resolution (width in pixels) */
const RESOLUTION = 640;

/** Random seed for reproducibility */
const SEED = 12345;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate percentile value from an array of numbers.
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate average of an array of numbers.
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate standard deviation of an array of numbers.
 */
function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Calculate coefficient of variation (CV) as a percentage.
 * CV = (stddev / mean) * 100
 * Higher CV indicates more variability relative to the mean.
 */
function coeffOfVariation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  if (avg === 0) return 0;
  return (stdDev(arr) / avg) * 100;
}

/**
 * Calculate 95% confidence interval half-width.
 * This is the "±" value: mean ± CI95 gives the interval.
 */
function confidence95(arr: number[]): number {
  if (arr.length === 0) return 0;
  const se = stdDev(arr) / Math.sqrt(arr.length);
  return 1.96 * se; // 1.96 for 95% CI (z-score)
}

/**
 * Create a benchmark result from collected frame metrics.
 */
function createBenchmarkResult(
  frameMetrics: RenderMetrics[],
  config: {
    mapName: string;
    polygonCount: number;
    edgeCount: number;
    renderer: string;
    materialPreset: string;
  }
): BenchmarkResult {
  const times = frameMetrics.map(m => m.renderTimeMs);
  const edgesTested = frameMetrics.map(m => m.edgesTested);
  const edgesVisible = frameMetrics.map(m => m.edgesVisible);

  // Calculate warmup-excluded metrics
  const timesNoWarmup = times.slice(WARMUP_FRAMES);

  return {
    timestamp: new Date().toISOString(),
    config: {
      ...config,
      resolution: RESOLUTION,
      frameCount: FRAME_COUNT,
    },
    metrics: {
      // Basic metrics (all frames)
      avgFrameTimeMs: average(times),
      minFrameTimeMs: Math.min(...times),
      maxFrameTimeMs: Math.max(...times),
      p95FrameTimeMs: percentile(times, 95),
      avgEdgesTested: average(edgesTested),
      avgEdgesVisible: average(edgesVisible),
      
      // Statistical rigor metrics (all frames)
      stdDevMs: stdDev(times),
      coeffOfVariation: coeffOfVariation(times),
      confidence95Ms: confidence95(times),
      
      // Warmup-excluded metrics (more reliable for comparison)
      warmupFrames: WARMUP_FRAMES,
      avgExcludingWarmup: average(timesNoWarmup),
      stdDevExcludingWarmup: stdDev(timesNoWarmup),
      ci95ExcludingWarmup: confidence95(timesNoWarmup),
    },
    frames: frameMetrics,
  };
}

/**
 * Run benchmark for a single renderer against given geometry and camera path.
 */
function runRendererBenchmark(
  renderer: IRendererCore,
  geometry: IGeometry,
  cameraPath: CameraPath
): RenderMetrics[] {
  const frameMetrics: RenderMetrics[] = [];

  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const camera = getCameraAtFrame(cameraPath, frame);
    const result = renderer.render(geometry, camera, RESOLUTION);
    frameMetrics.push(result.metrics);
  }

  return frameMetrics;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Rendering Performance Benchmark', () => {
  // Collect all results for final report
  const allResults: BenchmarkResult[] = [];

  // Create renderer instances
  const renderers: IRendererCore[] = [
    new ZBufferCore(),
    new RaycastCore(),
  ];

  // Load textures before all tests
  beforeAll(() => {
    // Load texture sources (makes textures available for the test environment)
    const textureSources = loadTextureSources();
    console.log(`Loaded ${textureSources.length} texture sources for benchmarking`);
  });

  // Write results after all tests complete
  afterAll(() => {
    // Ensure output directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    // Create report
    const report: BenchmarkReport = {
      runDate: new Date().toISOString(),
      results: allResults,
    };

    // Try to get git commit hash
    try {
      const { execSync } = require('child_process');
      report.gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
      // Git not available or not a git repo
    }

    // Write results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Benchmark results written to: ${RESULTS_FILE}`);
    console.log(`Total test cases: ${allResults.length}`);
    console.log(`${'='.repeat(60)}\n`);

    // Print summary table with statistical metrics
    console.log('Summary (avg frame time excluding warmup, with 95% CI):');
    console.log('-'.repeat(90));
    
    const grouped = new Map<string, Map<string, { avg: number; ci: number; cv: number }>>();
    for (const result of allResults) {
      const key = `${result.config.mapName}-${result.config.materialPreset}`;
      if (!grouped.has(key)) {
        grouped.set(key, new Map());
      }
      grouped.get(key)!.set(result.config.renderer, {
        avg: result.metrics.avgExcludingWarmup,
        ci: result.metrics.ci95ExcludingWarmup,
        cv: result.metrics.coeffOfVariation,
      });
    }

    for (const [key, rendererStats] of grouped) {
      const stats = Array.from(rendererStats.entries())
        .map(([r, s]) => `${r}: ${s.avg.toFixed(2)}±${s.ci.toFixed(2)}ms`)
        .join(', ');
      console.log(`${key}: ${stats}`);
    }
    
    // Baseline comparison
    console.log('');
    const baseline = loadBaseline(BASELINE_FILE);
    if (baseline) {
      console.log('Comparing against baseline...');
      const comparisons = compareToBaseline(allResults, baseline.results, WARMUP_FRAMES);
      console.log(formatComparisonReport(comparisons));
    } else {
      console.log('No baseline found. Run with --updateBaseline to create one.');
    }
    
    // Save as baseline if requested
    if (UPDATE_BASELINE) {
      saveBaseline(report, BASELINE_FILE);
      console.log(`\nBaseline saved to: ${BASELINE_FILE}`);
    }
  });

  // Generate tests for each size and material configuration
  SIZE_CONFIGS.forEach(sizeConfig => {
    MATERIAL_CONFIGS.forEach(materialPreset => {
      describe(`${sizeConfig.name} map (${sizeConfig.polygons} polygons) - ${materialPreset} materials`, () => {
        let geometryNoBsp: IGeometry;
        let geometryWithBsp: IGeometry;
        let cameraPath: CameraPath;

        beforeAll(() => {
          // Generate map with specified configuration
          const mapConfig: Partial<MapGeneratorConfig> = {
            ...DEFAULT_MAP_CONFIG,
            ...MATERIAL_PRESETS[materialPreset],
            seed: SEED,
          };

          const stored = generateComplexMap(sizeConfig.polygons, mapConfig);
          geometryNoBsp = loadGeometry(stored);

          // Build BSP tree for BSP-based renderer
          geometryWithBsp = {
            ...geometryNoBsp,
            bsp: buildBspTree(geometryNoBsp.polygons),
          };

          // Generate camera path
          cameraPath = generateCameraPath(geometryWithBsp, 10, 10, SEED);

          console.log(`\nGenerated ${sizeConfig.name} map: ${geometryNoBsp.polygons.length} polygons, ${geometryNoBsp.edgeCount} edges`);
        });

        // Test each renderer
        renderers.forEach(renderer => {
          test(`${renderer.name}`, () => {
            // Select appropriate geometry based on renderer requirements
            const geometry = renderer.requiresBsp ? geometryWithBsp : geometryNoBsp;

            // Run benchmark
            const frameMetrics = runRendererBenchmark(renderer, geometry, cameraPath);

            // Create and store result
            const result = createBenchmarkResult(frameMetrics, {
              mapName: sizeConfig.name,
              polygonCount: geometry.polygons.length,
              edgeCount: geometry.edgeCount,
              renderer: renderer.name,
              materialPreset,
            });

            allResults.push(result);

            // Log results with statistical metrics
            const m = result.metrics;
            console.log(
              `  ${renderer.name}: avg=${m.avgExcludingWarmup.toFixed(2)}ms ` +
              `(±${m.ci95ExcludingWarmup.toFixed(2)}ms), ` +
              `CV=${m.coeffOfVariation.toFixed(1)}%, ` +
              `edges=${m.avgEdgesTested.toFixed(0)}`
            );

            // Soft assertions - warn but don't fail
            if (m.avgExcludingWarmup > 16.67) {
              console.warn(`    ⚠️  Below 60fps target (${(1000 / m.avgExcludingWarmup).toFixed(1)} fps)`);
            }
            
            // Warn if high variance makes comparison unreliable
            if (m.coeffOfVariation > 50) {
              console.warn(`    ⚠️  High variance (CV=${m.coeffOfVariation.toFixed(1)}%) - comparisons may be unreliable`);
            }

            // Basic sanity checks that should pass
            expect(result.metrics.avgFrameTimeMs).toBeGreaterThan(0);
            expect(result.metrics.avgEdgesTested).toBeGreaterThanOrEqual(0);
          });
        });
      });
    });
  });
});
