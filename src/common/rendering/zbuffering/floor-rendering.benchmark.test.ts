/**
 * Floor Rendering Performance Benchmark Tests
 * 
 * Measures the performance of the floor/ceiling rendering pipeline (renderFloors)
 * using procedurally generated maps with polygon floor materials.
 * 
 * Run with: npx jest --testPathIgnorePatterns=[] --testPathPattern=floor-rendering.benchmark --no-coverage
 * 
 * Save as baseline:
 *   UPDATE_BASELINE=1 npx jest --testPathIgnorePatterns=[] --testPathPattern=floor-rendering.benchmark --no-coverage
 */

import 'jest-canvas-mock';
import * as fs from 'fs';
import * as path from 'path';

import { loadGeometry, IGeometry } from '../../geometry/geometry';
import { buildBspTree } from '../../geometry/bsp/creation';
import { IBSPNode } from '../../geometry/bsp/model';
import { makeCamera, ICamera, makeRays, clip } from '../../camera';
import { IRay } from '../../geometry/collision';
import { IPolygon } from '../../geometry/polygon';
import { buildPolygonGrid, IPolygonGrid } from '../../geometry/polygon-grid';
import { renderFloors, buildColumnBounds, IFloorRendererConfig, IColumnWallBounds } from './floor-renderer';
import { IWorldConfigState, DEFAULT_FLOOR_MATERIAL } from '../../store/world-config';
import { walkWithFrustum } from '../../geometry/bsp/querying';
import { NULL_EDGE } from '../../geometry/edge';
import { castRaysOnEdgeRange } from '../raycasting/raycaster';
import { getMaterial } from '../../geometry/properties';
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
const RESULTS_FILE = path.join(RESULTS_DIR, 'floor-rendering-metrics.json');
const BASELINE_FILE = path.join(RESULTS_DIR, 'floor-rendering-baseline.json');
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
const SEED = 54321;

/** Floor rendering configurations to test */
const FLOOR_CONFIGS = [
  { 
    name: 'dense-flat', 
    polygons: 200, 
    floorMaterialRatio: 0.8,
    ceilingMaterialRatio: 0,
    floorTextureRatio: 0,
    description: 'Many polygons with flat-color floors, no textures',
  },
  { 
    name: 'dense-textured', 
    polygons: 200, 
    floorMaterialRatio: 0.8,
    ceilingMaterialRatio: 0,
    floorTextureRatio: 0.8,
    description: 'Many polygons with textured floors',
  },
  { 
    name: 'dense-floor-ceiling', 
    polygons: 200, 
    floorMaterialRatio: 0.6,
    ceilingMaterialRatio: 0.4,
    floorTextureRatio: 0.5,
    description: 'Both floor and ceiling materials',
  },
  { 
    name: 'sparse-floor', 
    polygons: 200, 
    floorMaterialRatio: 0.1,
    ceilingMaterialRatio: 0,
    floorTextureRatio: 0,
    description: 'Few polygons with floors (worst-case iteration overhead)',
  },
  { 
    name: 'stress-all', 
    polygons: 500, 
    floorMaterialRatio: 1.0,
    ceilingMaterialRatio: 0.5,
    floorTextureRatio: 0.9,
    description: 'Maximum complexity: all floors, half ceilings, mostly textured',
  },
] as const;

// ============================================================================
// Types
// ============================================================================

interface FloorBenchmarkMetrics {
  /** Time for renderFloors() call in ms */
  floorRenderTimeMs: number;
  /** Time to build polygon grid in ms */
  gridBuildTimeMs: number;
  /** Time to build column bounds in ms */
  columnBoundsTimeMs: number;
  /** Total time (grid + bounds + render) in ms */
  totalTimeMs: number;
  /** Number of polygons with floor/ceiling materials */
  floorPolygonCount: number;
  /** Number of cells in the polygon grid */
  gridCellCount: number;
}

interface FloorBenchmarkResult {
  timestamp: string;
  config: {
    name: string;
    description: string;
    polygonCount: number;
    floorPolygonCount: number;
    screenWidth: number;
    screenHeight: number;
    frameCount: number;
  };
  metrics: {
    avgFloorRenderMs: number;
    minFloorRenderMs: number;
    maxFloorRenderMs: number;
    p95FloorRenderMs: number;
    avgTotalMs: number;
    avgGridBuildMs: number;
    avgColumnBoundsMs: number;
    stdDevMs: number;
    avgExcludingWarmup: number;
    stdDevExcludingWarmup: number;
  };
  frames: FloorBenchmarkMetrics[];
}

interface FloorBenchmarkReport {
  runDate: string;
  gitCommit?: string;
  results: FloorBenchmarkResult[];
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
// Wall Bounds Simulation
// ============================================================================

/**
 * Simulate the ZBuffer wall pass to get realistic column bounds.
 * This does a simplified version of what ZBufferRenderer does:
 * walks BSP, clips edges, casts rays to get wall heights per column.
 */
function simulateWallBounds(
  geometry: IGeometry,
  bsp: IBSPNode,
  camera: ICamera,
  rays: IRay[],
  resolution: number,
  screenHeight: number,
): IColumnWallBounds[] {
  // Track nearest opaque wall distance per column
  const nearestDist = new Float64Array(resolution).fill(Infinity);

  // Walk BSP and find nearest wall per column
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
          const alpha = material?.color[3] ?? 0;
          if (alpha === 1 && hits[i].distance < nearestDist[i]) {
            nearestDist[i] = hits[i].distance;
          }
        }
      }
    }
    return true;
  });

  // Convert distances to wall bounds
  const halfScreen = screenHeight / 2;
  const bounds: IColumnWallBounds[] = new Array(resolution);
  for (let i = 0; i < resolution; i++) {
    if (nearestDist[i] < Infinity) {
      const wallHeight = 10 * screenHeight / nearestDist[i];
      const wallTop = Math.floor(halfScreen - wallHeight / 2);
      const wallBottom = Math.floor(halfScreen + wallHeight / 2);
      bounds[i] = { wallTop, wallBottom, hasWall: true };
    } else {
      bounds[i] = { wallTop: halfScreen, wallBottom: halfScreen, hasWall: false };
    }
  }
  return bounds;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Floor Rendering Performance Benchmark', () => {
  const allResults: FloorBenchmarkResult[] = [];

  // Load textures before all tests
  beforeAll(() => {
    const textureSources = loadTextureSources();
    console.log(`Loaded ${textureSources.length} texture sources for floor benchmarking`);
  });

  // Write results after all tests
  afterAll(() => {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    const report: FloorBenchmarkReport = {
      runDate: new Date().toISOString(),
      results: allResults,
    };

    try {
      const { execSync } = require('child_process');
      report.gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch { /* git not available */ }

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Floor benchmark results written to: ${RESULTS_FILE}`);
    console.log(`Total test cases: ${allResults.length}`);
    console.log(`${'='.repeat(60)}\n`);

    // Print summary table
    console.log('Summary (avg renderFloors time excluding warmup):');
    console.log('-'.repeat(70));
    for (const result of allResults) {
      const m = result.metrics;
      console.log(
        `  ${result.config.name}: ` +
        `render=${m.avgExcludingWarmup.toFixed(2)}ms, ` +
        `grid=${m.avgGridBuildMs.toFixed(2)}ms, ` +
        `total=${m.avgTotalMs.toFixed(2)}ms, ` +
        `floorPolys=${result.config.floorPolygonCount}`
      );
    }

    // Baseline comparison
    console.log('');
    if (fs.existsSync(BASELINE_FILE)) {
      try {
        const baseline: FloorBenchmarkReport = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
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

  // Generate tests for each floor configuration
  FLOOR_CONFIGS.forEach(floorConfig => {
    test(`${floorConfig.name} - ${floorConfig.description}`, () => {
      // Generate map with floor materials
      const mapConfig: Partial<MapGeneratorConfig> = {
        ...DEFAULT_MAP_CONFIG,
        seed: SEED,
        floorMaterialRatio: floorConfig.floorMaterialRatio,
        ceilingMaterialRatio: floorConfig.ceilingMaterialRatio,
        floorTextureRatio: floorConfig.floorTextureRatio,
      };

      const stored = generateComplexMap(floorConfig.polygons, mapConfig);
      const geometry = loadGeometry(stored);

      // Count polygons with floor/ceiling materials
      const floorPolygonCount = geometry.polygons.filter(
        p => p.floorMaterial != null || p.ceilingMaterial != null
      ).length;

      console.log(
        `\n  Generated ${floorConfig.name}: ` +
        `${geometry.polygons.length} polygons, ` +
        `${floorPolygonCount} with floor/ceiling`
      );

      // Build BSP tree (needed for wall bounds simulation)
      const bsp = buildBspTree(geometry.polygons);

      // Generate camera path
      const cameraPath = generateCameraPath(geometry, 8, 10, SEED);

      // Create a mock canvas context
      const canvas = document.createElement('canvas');
      canvas.width = SCREEN_WIDTH;
      canvas.height = SCREEN_HEIGHT;
      const ctx = canvas.getContext('2d')!;

      const floorRendererConfig: IFloorRendererConfig = {
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        halfHeightConstant: 5,
      };

      const worldConfig: IWorldConfigState = {
        floorMaterial: DEFAULT_FLOOR_MATERIAL,
        floorColor: [50, 80, 80],
        sunAngle: Math.PI / 2,
      };

      const frameMetrics: FloorBenchmarkMetrics[] = [];

      for (let frame = 0; frame < FRAME_COUNT; frame++) {
        const camera = getCameraAtFrame(cameraPath, frame);
        const rays = makeRays(RESOLUTION, camera);

        // Phase 1: Build column bounds (simulate wall pass)
        const t0 = performance.now();
        const columnBounds = simulateWallBounds(
          geometry, bsp, camera, rays, RESOLUTION, SCREEN_HEIGHT
        );
        const t1 = performance.now();

        // Phase 2: Collect visible polygons and build grid
        const visiblePolygons: IPolygon[] = [];
        walkWithFrustum(bsp, camera.position, camera.planes, (polygons) => {
          for (const p of polygons) {
            if (p.floorMaterial != null || p.ceilingMaterial != null) {
              visiblePolygons.push(p);
            }
          }
          return true;
        });
        const grid = buildPolygonGrid(visiblePolygons);
        const t2 = performance.now();

        // Phase 3: Render floors (THE TARGET OF OPTIMIZATION)
        renderFloors(
          ctx, camera, rays, columnBounds, grid,
          floorRendererConfig, worldConfig, null,
        );
        const t3 = performance.now();

        frameMetrics.push({
          floorRenderTimeMs: t3 - t2,
          gridBuildTimeMs: t2 - t1,
          columnBoundsTimeMs: t1 - t0,
          totalTimeMs: t3 - t0,
          floorPolygonCount: visiblePolygons.length,
          gridCellCount: grid.cellCount,
        });
      }

      // Compute aggregate metrics
      const renderTimes = frameMetrics.map(m => m.floorRenderTimeMs);
      const renderTimesNoWarmup = renderTimes.slice(WARMUP_FRAMES);
      const totalTimes = frameMetrics.map(m => m.totalTimeMs);
      const gridTimes = frameMetrics.map(m => m.gridBuildTimeMs);
      const boundsTimes = frameMetrics.map(m => m.columnBoundsTimeMs);

      const result: FloorBenchmarkResult = {
        timestamp: new Date().toISOString(),
        config: {
          name: floorConfig.name,
          description: floorConfig.description,
          polygonCount: geometry.polygons.length,
          floorPolygonCount,
          screenWidth: SCREEN_WIDTH,
          screenHeight: SCREEN_HEIGHT,
          frameCount: FRAME_COUNT,
        },
        metrics: {
          avgFloorRenderMs: average(renderTimes),
          minFloorRenderMs: Math.min(...renderTimes),
          maxFloorRenderMs: Math.max(...renderTimes),
          p95FloorRenderMs: percentile(renderTimes, 95),
          avgTotalMs: average(totalTimes),
          avgGridBuildMs: average(gridTimes),
          avgColumnBoundsMs: average(boundsTimes),
          stdDevMs: stdDev(renderTimes),
          avgExcludingWarmup: average(renderTimesNoWarmup),
          stdDevExcludingWarmup: stdDev(renderTimesNoWarmup),
        },
        frames: frameMetrics,
      };

      allResults.push(result);

      // Log results
      const m = result.metrics;
      console.log(
        `  Results: renderFloors avg=${m.avgExcludingWarmup.toFixed(2)}ms, ` +
        `total=${m.avgTotalMs.toFixed(2)}ms, ` +
        `grid=${m.avgGridBuildMs.toFixed(2)}ms, ` +
        `p95=${m.p95FloorRenderMs.toFixed(2)}ms`
      );

      // Sanity checks
      expect(frameMetrics.length).toBe(FRAME_COUNT);
      expect(result.metrics.avgFloorRenderMs).toBeGreaterThanOrEqual(0);
    }, 120000); // 2-minute timeout
  });
});
