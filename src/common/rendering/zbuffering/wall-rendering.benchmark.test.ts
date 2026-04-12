/**
 * Wall Rendering Performance Benchmark Tests
 * 
 * Measures the performance of the pixel-based wall rendering pipeline (renderWalls)
 * using procedurally generated maps with configurable wall materials.
 * 
 * Run with: npx jest --testPathIgnorePatterns=[] --testPathPattern=wall-rendering.benchmark --no-coverage
 * 
 * Save as baseline:
 *   UPDATE_BASELINE=1 npx jest --testPathIgnorePatterns=[] --testPathPattern=wall-rendering.benchmark --no-coverage
 */

import 'jest-canvas-mock';
import * as fs from 'fs';
import * as path from 'path';

import { loadGeometry, IGeometry } from '../../geometry/geometry';
import { buildBspTree } from '../../geometry/bsp/creation';
import { IBSPNode } from '../../geometry/bsp/model';
import { makeCamera, ICamera, makeRays, clip } from '../../camera';
import { IRay } from '../../geometry/collision';
import { walkWithFrustum } from '../../geometry/bsp/querying';
import { NULL_EDGE } from '../../geometry/edge';
import { castRaysOnEdgeRange } from '../raycasting/raycaster';
import { getMaterial } from '../../geometry/properties';
import { WallPainter, WallProps } from '../../drawing/wall-painter';
import { renderWalls, IWallTextureProvider } from './wall-renderer';
import { IWorldConfigState } from '../../store/world-config';
import { 
  generateComplexMap, 
  MapGeneratorConfig, 
  DEFAULT_MAP_CONFIG,
} from '../../testing/map-generator';
import { 
  generateCameraPath, 
  getCameraAtFrame, 
  CameraPath 
} from '../../testing/camera-path';
import { loadTextureSources } from '../../testing/texture-loader';

// ============================================================================
// Configuration
// ============================================================================

const RESULTS_DIR = path.join(__dirname, '../../../../benchmark-results');
const RESULTS_FILE = path.join(RESULTS_DIR, 'wall-rendering-metrics.json');
const BASELINE_FILE = path.join(RESULTS_DIR, 'wall-rendering-baseline.json');
const UPDATE_BASELINE = process.env.UPDATE_BASELINE === '1' || process.env.UPDATE_BASELINE === 'true';

/** Screen dimensions */
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
const RESOLUTION = SCREEN_WIDTH;

/** Number of frames to render per test */
const FRAME_COUNT = 60;
/** Number of warmup frames to exclude */
const WARMUP_FRAMES = 5;
/** Random seed for reproducibility */
const SEED = 67890;

/** Wall rendering configurations to test */
const WALL_CONFIGS = [
  { 
    name: 'flat-only', 
    polygons: 200, 
    texturedWallRatio: 0,
    translucentWallRatio: 0,
    translucentAlpha: 1,
    fadeOn: undefined as number | undefined,
    description: 'Flat-color walls only, no textures or fading',
  },
  { 
    name: 'textured-only', 
    polygons: 200, 
    texturedWallRatio: 0.8,
    translucentWallRatio: 0,
    translucentAlpha: 1,
    fadeOn: undefined as number | undefined,
    description: 'Textured walls, no translucency or fading',
  },
  { 
    name: 'translucent', 
    polygons: 200, 
    texturedWallRatio: 0.5,
    translucentWallRatio: 0.3,
    translucentAlpha: 0.5,
    fadeOn: undefined as number | undefined,
    description: 'Mix of textured and translucent walls',
  },
  { 
    name: 'faded', 
    polygons: 200, 
    texturedWallRatio: 0.7,
    translucentWallRatio: 0,
    translucentAlpha: 1,
    fadeOn: 0,
    description: 'Textured walls with distance fading enabled',
  },
  { 
    name: 'mixed-stress', 
    polygons: 500, 
    texturedWallRatio: 0.9,
    translucentWallRatio: 0.4,
    translucentAlpha: 0.3,
    fadeOn: 0,
    description: 'Maximum complexity: textured, translucent, faded, many polygons',
  },
] as const;

// ============================================================================
// Types
// ============================================================================

interface WallBenchmarkMetrics {
  /** Time for renderWalls() call in ms */
  wallRenderTimeMs: number;
  /** Time to populate ZBuffer columns in ms */
  zbufferPopulateTimeMs: number;
  /** Total time (populate + render) in ms */
  totalTimeMs: number;
  /** Number of wall columns with data */
  columnsWithWalls: number;
  /** Total number of wall segments across all columns */
  totalWallSegments: number;
}

interface WallBenchmarkResult {
  timestamp: string;
  config: {
    name: string;
    description: string;
    polygonCount: number;
    screenWidth: number;
    screenHeight: number;
    frameCount: number;
  };
  metrics: {
    avgWallRenderMs: number;
    minWallRenderMs: number;
    maxWallRenderMs: number;
    p95WallRenderMs: number;
    avgTotalMs: number;
    avgZbufferPopulateMs: number;
    stdDevMs: number;
    avgExcludingWarmup: number;
    stdDevExcludingWarmup: number;
    avgColumnsWithWalls: number;
    avgTotalWallSegments: number;
  };
  frames: WallBenchmarkMetrics[];
}

interface WallBenchmarkReport {
  runDate: string;
  gitCommit?: string;
  results: WallBenchmarkResult[];
}

// ============================================================================
// Utility Functions
// ============================================================================

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// ============================================================================
// ZBuffer Population Simulation
// ============================================================================

/**
 * Simulate the ZBuffer population phase: walk BSP, clip edges, cast rays,
 * and build per-column wall data (sorted ascending by distance).
 * 
 * Returns an array of columns matching the interface expected by renderWalls().
 */
function populateWallColumns(
  geometry: IGeometry,
  bsp: IBSPNode,
  camera: ICamera,
  rays: IRay[],
  resolution: number,
  screenHeight: number,
  wallPainter: WallPainter,
): { walls: WallProps[], count: number }[] {
  const columns: { walls: WallProps[], count: number }[] = new Array(resolution);
  for (let i = 0; i < resolution; i++) {
    columns[i] = { walls: [], count: 0 };
  }

  walkWithFrustum(bsp, camera.position, camera.planes, (polygons) => {
    for (const p of polygons) {
      for (const e of p.edges) {
        if (e.material == null) continue;
        const clipped = clip(e, camera);
        if (clipped === NULL_EDGE) continue;

        const hits = castRaysOnEdgeRange(rays, 0, resolution, clipped);
        for (let i = 0; i < hits.length; i++) {
          if (hits[i].intersection === null) continue;
          const material = getMaterial(hits[i].intersection.face, e.material);
          if ((material?.color[3] ?? 0) === 0) continue;

          const wall = wallPainter.createWall(hits[i], i, e.start.vector);
          if (wall.height <= 0) continue;

          // Insert sorted by distance (ascending)
          const col = columns[i];
          const d = wall.distance;
          let j = col.count;
          if (j >= col.walls.length) {
            col.walls.push(wall);
          } else {
            col.walls[j] = wall;
          }
          while (j > 0 && col.walls[j - 1].distance > d) {
            col.walls[j] = col.walls[j - 1];
            j--;
          }
          col.walls[j] = wall;
          col.count++;
        }
      }
    }
    return true;
  });

  return columns;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Wall Rendering Performance Benchmark', () => {
  const allResults: WallBenchmarkResult[] = [];

  // Load textures before all tests
  beforeAll(() => {
    const textureSources = loadTextureSources();
    console.log(`Loaded ${textureSources.length} texture sources for wall benchmarking`);
  });

  // Write results after all tests
  afterAll(() => {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    const report: WallBenchmarkReport = {
      runDate: new Date().toISOString(),
      results: allResults,
    };

    try {
      const { execSync } = require('child_process');
      report.gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch { /* git not available */ }

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Wall benchmark results written to: ${RESULTS_FILE}`);
    console.log(`Total test cases: ${allResults.length}`);
    console.log(`${'='.repeat(60)}\n`);

    // Print summary table
    console.log('Summary (avg renderWalls time excluding warmup):');
    console.log('-'.repeat(70));
    for (const result of allResults) {
      const m = result.metrics;
      console.log(
        `  ${result.config.name}: ` +
        `render=${m.avgExcludingWarmup.toFixed(2)}ms, ` +
        `populate=${m.avgZbufferPopulateMs.toFixed(2)}ms, ` +
        `total=${m.avgTotalMs.toFixed(2)}ms, ` +
        `walls/frame=${m.avgTotalWallSegments.toFixed(0)}`
      );
    }

    // Baseline comparison
    console.log('');
    if (fs.existsSync(BASELINE_FILE)) {
      try {
        const baseline: WallBenchmarkReport = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
        console.log('Comparing against baseline...');
        console.log('-'.repeat(70));
        for (const current of allResults) {
          const base = baseline.results.find(r => r.config.name === current.config.name);
          if (!base) {
            console.log(`  ${current.config.name}: no baseline`);
            continue;
          }
          const diff = current.metrics.avgExcludingWarmup - base.metrics.avgExcludingWarmup;
          const pct = base.metrics.avgExcludingWarmup !== 0
            ? (diff / base.metrics.avgExcludingWarmup * 100)
            : 0;
          const marker = Math.abs(pct) < 5 ? '[  OK  ]' : (diff > 0 ? '[REGRESS]' : '[IMPROVE]');
          console.log(
            `  ${marker} ${current.config.name}: ` +
            `${base.metrics.avgExcludingWarmup.toFixed(2)}ms -> ${current.metrics.avgExcludingWarmup.toFixed(2)}ms ` +
            `(${diff >= 0 ? '+' : ''}${diff.toFixed(2)}ms, ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`
          );
        }
      } catch {
        console.log('Failed to load baseline.');
      }
    } else {
      console.log('No baseline found. Run with UPDATE_BASELINE=1 to create one.');
    }

    // Save as baseline if requested
    if (UPDATE_BASELINE) {
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(report, null, 2));
      console.log(`\nBaseline saved to: ${BASELINE_FILE}`);
    }
  });

  // Generate tests for each wall configuration
  WALL_CONFIGS.forEach(wallConfig => {
    test(`${wallConfig.name} - ${wallConfig.description}`, () => {
      // Generate map with wall materials
      const mapConfig: Partial<MapGeneratorConfig> = {
        ...DEFAULT_MAP_CONFIG,
        seed: SEED,
        texturedWallRatio: wallConfig.texturedWallRatio,
        translucentWallRatio: wallConfig.translucentWallRatio,
        translucentAlpha: wallConfig.translucentAlpha,
      };

      const stored = generateComplexMap(wallConfig.polygons, mapConfig);
      const geometry = loadGeometry(stored);

      console.log(
        `\n  Generated ${wallConfig.name}: ` +
        `${geometry.polygons.length} polygons, ` +
        `${stored.polygons.reduce((sum, p) => sum + p.edges.length, 0)} edges`
      );

      // Build BSP tree
      const bsp = buildBspTree(geometry.polygons);

      // Generate camera path
      const cameraPath = generateCameraPath(geometry, 8, 10, SEED);

      // Create a mock canvas context
      const canvas = document.createElement('canvas');
      canvas.width = SCREEN_WIDTH;
      canvas.height = SCREEN_HEIGHT;
      const ctx = canvas.getContext('2d')!;

      // Create WallPainter for building WallProps
      const wallPainter = new WallPainter(ctx, RESOLUTION, SCREEN_HEIGHT, SCREEN_WIDTH);

      const worldConfig: IWorldConfigState = {
        fadeOn: wallConfig.fadeOn,
        horizonDistance: 300,
        sunAngle: Math.PI / 2,
      };

      const frameMetrics: WallBenchmarkMetrics[] = [];

      for (let frame = 0; frame < FRAME_COUNT; frame++) {
        const camera = getCameraAtFrame(cameraPath, frame);
        const rays = makeRays(RESOLUTION, camera);

        // Phase 1: Populate ZBuffer columns
        const t0 = performance.now();
        const columns = populateWallColumns(
          geometry, bsp, camera, rays, RESOLUTION, SCREEN_HEIGHT, wallPainter
        );
        const t1 = performance.now();

        // Phase 2: Render walls (THE TARGET OF OPTIMIZATION)
        renderWalls(
          ctx, columns, SCREEN_WIDTH, SCREEN_HEIGHT,
          worldConfig, null, // no texture provider in test (jest-canvas-mock)
        );
        const t2 = performance.now();

        // Compute per-frame stats
        let columnsWithWalls = 0;
        let totalWallSegments = 0;
        for (let i = 0; i < columns.length; i++) {
          if (columns[i].count > 0) {
            columnsWithWalls++;
            totalWallSegments += columns[i].count;
          }
        }

        frameMetrics.push({
          wallRenderTimeMs: t2 - t1,
          zbufferPopulateTimeMs: t1 - t0,
          totalTimeMs: t2 - t0,
          columnsWithWalls,
          totalWallSegments,
        });
      }

      // Compute aggregate metrics
      const renderTimes = frameMetrics.map(m => m.wallRenderTimeMs);
      const renderTimesNoWarmup = renderTimes.slice(WARMUP_FRAMES);
      const totalTimes = frameMetrics.map(m => m.totalTimeMs);
      const populateTimes = frameMetrics.map(m => m.zbufferPopulateTimeMs);

      const result: WallBenchmarkResult = {
        timestamp: new Date().toISOString(),
        config: {
          name: wallConfig.name,
          description: wallConfig.description,
          polygonCount: geometry.polygons.length,
          screenWidth: SCREEN_WIDTH,
          screenHeight: SCREEN_HEIGHT,
          frameCount: FRAME_COUNT,
        },
        metrics: {
          avgWallRenderMs: average(renderTimes),
          minWallRenderMs: Math.min(...renderTimes),
          maxWallRenderMs: Math.max(...renderTimes),
          p95WallRenderMs: percentile(renderTimes, 95),
          avgTotalMs: average(totalTimes),
          avgZbufferPopulateMs: average(populateTimes),
          stdDevMs: stdDev(renderTimes),
          avgExcludingWarmup: average(renderTimesNoWarmup),
          stdDevExcludingWarmup: stdDev(renderTimesNoWarmup),
          avgColumnsWithWalls: average(frameMetrics.map(m => m.columnsWithWalls)),
          avgTotalWallSegments: average(frameMetrics.map(m => m.totalWallSegments)),
        },
        frames: frameMetrics,
      };

      allResults.push(result);

      // Log results
      const m = result.metrics;
      console.log(
        `  Results: renderWalls avg=${m.avgExcludingWarmup.toFixed(2)}ms, ` +
        `total=${m.avgTotalMs.toFixed(2)}ms, ` +
        `populate=${m.avgZbufferPopulateMs.toFixed(2)}ms, ` +
        `walls/frame=${m.avgTotalWallSegments.toFixed(0)}, ` +
        `p95=${m.p95WallRenderMs.toFixed(2)}ms`
      );

      // Sanity checks
      expect(frameMetrics.length).toBe(FRAME_COUNT);
      expect(result.metrics.avgWallRenderMs).toBeGreaterThanOrEqual(0);
    }, 120000); // 2-minute timeout
  });
});
