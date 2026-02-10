/**
 * Rendering Performance Benchmark Tests
 * 
 * Tests the performance of both rendering pipelines (ZBuffer/BSP and traditional
 * raycasting) against procedurally generated maps of varying complexity.
 * 
 * Run with: npm test -- --testPathPattern=benchmark
 * 
 * Results are written to benchmark-results/rendering-metrics.json
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

// ============================================================================
// Configuration
// ============================================================================

/** Output directory for benchmark results */
const RESULTS_DIR = path.join(__dirname, '../../../benchmark-results');
/** Output file for benchmark metrics */
const RESULTS_FILE = path.join(RESULTS_DIR, 'rendering-metrics.json');

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

  return {
    timestamp: new Date().toISOString(),
    config: {
      ...config,
      resolution: RESOLUTION,
      frameCount: FRAME_COUNT,
    },
    metrics: {
      avgFrameTimeMs: average(times),
      minFrameTimeMs: Math.min(...times),
      maxFrameTimeMs: Math.max(...times),
      p95FrameTimeMs: percentile(times, 95),
      avgEdgesTested: average(edgesTested),
      avgEdgesVisible: average(edgesVisible),
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

    // Print summary table
    console.log('Summary (avg frame time in ms):');
    console.log('-'.repeat(80));
    
    const grouped = new Map<string, Map<string, number>>();
    for (const result of allResults) {
      const key = `${result.config.mapName}-${result.config.materialPreset}`;
      if (!grouped.has(key)) {
        grouped.set(key, new Map());
      }
      grouped.get(key)!.set(result.config.renderer, result.metrics.avgFrameTimeMs);
    }

    for (const [key, rendererTimes] of grouped) {
      const times = Array.from(rendererTimes.entries())
        .map(([r, t]) => `${r}: ${t.toFixed(2)}ms`)
        .join(', ');
      console.log(`${key}: ${times}`);
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

            // Log results
            console.log(
              `  ${renderer.name}: avg=${result.metrics.avgFrameTimeMs.toFixed(2)}ms, ` +
              `p95=${result.metrics.p95FrameTimeMs.toFixed(2)}ms, ` +
              `edges=${result.metrics.avgEdgesTested.toFixed(0)}`
            );

            // Soft assertions - warn but don't fail
            if (result.metrics.avgFrameTimeMs > 16.67) {
              console.warn(`    ⚠️  Below 60fps target (${(1000 / result.metrics.avgFrameTimeMs).toFixed(1)} fps)`);
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
