/**
 * Renderer Comparison Test
 * 
 * Verifies that ZBuffer rendering with frustum culling produces identical
 * per-column hit data as ZBuffer rendering without frustum culling.
 * 
 * This ensures the frustum culling optimization doesn't miss any visible edges.
 */

import { geometries, resetTestRandom } from '../testing/factories';
import { makeCamera, ICamera } from '../camera';
import { ZBufferCore } from './zbuffering/zbuffer-core';
import { ColumnHit } from './renderer-core';
import { Vector } from '../math/vector';

beforeEach(() => resetTestRandom());

/** Compare column hits from two renderers, returning mismatch details */
function compareColumnHits(
  withCulling: ColumnHit[][],
  withoutCulling: ColumnHit[][],
): { column: number; type: string; detail: string }[] {
  const mismatches: { column: number; type: string; detail: string }[] = [];
  
  const maxCols = Math.max(withCulling.length, withoutCulling.length);
  for (let col = 0; col < maxCols; col++) {
    const a = withCulling[col] ?? [];
    const b = withoutCulling[col] ?? [];
    
    if (a.length !== b.length) {
      mismatches.push({
        column: col,
        type: 'hit_count',
        detail: `frustum=${a.length} vs no-frustum=${b.length}`,
      });
      continue;
    }
    
    for (let h = 0; h < a.length; h++) {
      if (a[h].edgeId !== b[h].edgeId) {
        mismatches.push({
          column: col,
          type: 'different_edge',
          detail: `hit[${h}]: frustum=${a[h].edgeId} vs no-frustum=${b[h].edgeId}`,
        });
      } else if (Math.abs(a[h].distance - b[h].distance) > 0.001) {
        mismatches.push({
          column: col,
          type: 'different_distance',
          detail: `hit[${h}]: frustum=${a[h].distance.toFixed(4)} vs no-frustum=${b[h].distance.toFixed(4)}`,
        });
      }
    }
  }
  
  return mismatches;
}

interface TestScene {
  name: string;
  polygons: Vector[][];
  cameras: { position: Vector; direction: Vector; plane: Vector }[];
}

/**
 * Define test scenes with varying complexity.
 * Each scene has geometry and multiple camera positions/orientations.
 */
const testScenes: TestScene[] = [
  {
    name: 'single rectangle',
    polygons: [
      [[0, 20], [100, 20], [100, 30], [0, 30]],
    ],
    cameras: [
      { position: [50, 0], direction: [0, 10], plane: [15, 0] },
      { position: [50, 0], direction: [1, 10], plane: [15, 0] },  // slightly rotated
      { position: [0, 0], direction: [1, 10], plane: [15, 0] },   // off-center
    ],
  },
  {
    name: 'L-shaped room',
    polygons: [
      [[0, 10], [50, 10], [50, 20], [0, 20]],
      [[40, 10], [50, 10], [50, 50], [40, 50]],
    ],
    cameras: [
      { position: [25, 0], direction: [0, 10], plane: [15, 0] },
      { position: [25, 0], direction: [5, 10], plane: [15, 0] },
      { position: [45, 0], direction: [0, 10], plane: [15, 0] },
    ],
  },
  {
    name: 'multiple scattered polygons',
    polygons: [
      [[0, 20], [30, 20], [30, 30], [0, 30]],
      [[50, 15], [80, 15], [80, 25], [50, 25]],
      [[20, 40], [60, 40], [60, 50], [20, 50]],
      [[-20, 30], [-10, 30], [-10, 60], [-20, 60]],
      [[90, 10], [110, 10], [110, 45], [90, 45]],
    ],
    cameras: [
      { position: [40, 0], direction: [0, 10], plane: [15, 0] },
      { position: [40, 0], direction: [-5, 10], plane: [15, 0] },
      { position: [40, 0], direction: [5, 10], plane: [15, 0] },
      { position: [0, 0], direction: [3, 10], plane: [15, 0] },
      { position: [80, 0], direction: [-3, 10], plane: [15, 0] },
    ],
  },
];

describe('Renderer Comparison: frustum culling correctness', () => {
  const resolution = 64;
  
  for (const scene of testScenes) {
    describe(scene.name, () => {
      for (let camIdx = 0; camIdx < scene.cameras.length; camIdx++) {
        const camDef = scene.cameras[camIdx];
        
        test(`camera ${camIdx}: pos=[${camDef.position}] dir=[${camDef.direction}]`, () => {
          const geom = geometries.withBsp(scene.polygons);
          const camera: ICamera = makeCamera(camDef);
          
          // Render with frustum culling
          const withCulling = new ZBufferCore(false, true, true);
          const resultCulled = withCulling.render(geom, camera, resolution);
          
          // Render without frustum culling
          const withoutCulling = new ZBufferCore(false, true, false);
          const resultNoCull = withoutCulling.render(geom, camera, resolution);
          
          // Both should have column hits (captureHits=true)
          expect(resultCulled.columnHits).toBeDefined();
          expect(resultNoCull.columnHits).toBeDefined();
          
          const mismatches = compareColumnHits(
            resultCulled.columnHits!,
            resultNoCull.columnHits!,
          );
          
          if (mismatches.length > 0) {
            const summary = mismatches.slice(0, 10).map(
              m => `  col ${m.column}: ${m.type} - ${m.detail}`
            ).join('\n');
            fail(
              `Found ${mismatches.length} mismatch(es) between frustum-culled and non-culled rendering:\n${summary}`
            );
          }
        });
      }
    });
  }
  
  test('frustum culling tests fewer edges (performance benefit)', () => {
    // Use a scene where some geometry is clearly outside the frustum
    const geom = geometries.withBsp([
      // Wall directly in front
      [[0, 20], [100, 20], [100, 30], [0, 30]],
      // Walls far to the sides (should be culled)
      [[-200, 20], [-150, 20], [-150, 30], [-200, 30]],
      [[250, 20], [300, 20], [300, 30], [250, 30]],
      // Wall behind camera (should be culled)
      [[0, -30], [100, -30], [100, -20], [0, -20]],
    ]);
    const camera = makeCamera({ position: [50, 0], direction: [0, 10], plane: [15, 0] });
    
    const withCulling = new ZBufferCore(false, false, true);
    const withoutCulling = new ZBufferCore(false, false, false);
    
    const resultCulled = withCulling.render(geom, camera, 64);
    const resultNoCull = withoutCulling.render(geom, camera, 64);
    
    // Frustum culling should test fewer or equal edges
    expect(resultCulled.metrics.edgesTested).toBeLessThanOrEqual(
      resultNoCull.metrics.edgesTested
    );
    
    // But visible edges should be the same
    expect(resultCulled.metrics.edgesVisible).toBe(resultNoCull.metrics.edgesVisible);
  });
});
