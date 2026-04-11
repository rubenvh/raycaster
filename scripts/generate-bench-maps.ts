/**
 * Generates benchmark map files in assets/maps/ for each floor rendering test case.
 *
 * Run with: npx ts-node scripts/generate-bench-maps.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateComplexMap, DEFAULT_MAP_CONFIG, MapGeneratorConfig } from '../src/common/testing/map-generator';
import { makeCamera } from '../src/common/camera';

const SEED = 54321;
const MAPS_DIR = path.join(__dirname, '..', 'assets', 'maps');

const configs = [
  { name: 'bench-dense-flat', polygons: 200, floorMaterialRatio: 0.8, ceilingMaterialRatio: 0, floorTextureRatio: 0, description: 'Many polygons with flat-color floors, no textures' },
  { name: 'bench-dense-textured', polygons: 200, floorMaterialRatio: 0.8, ceilingMaterialRatio: 0, floorTextureRatio: 0.8, description: 'Many polygons with textured floors' },
  { name: 'bench-dense-floor-ceiling', polygons: 200, floorMaterialRatio: 0.6, ceilingMaterialRatio: 0.4, floorTextureRatio: 0.5, description: 'Both floor and ceiling materials' },
  { name: 'bench-sparse-floor', polygons: 200, floorMaterialRatio: 0.1, ceilingMaterialRatio: 0, floorTextureRatio: 0, description: 'Few polygons with floors' },
  { name: 'bench-stress-all', polygons: 500, floorMaterialRatio: 1.0, ceilingMaterialRatio: 0.5, floorTextureRatio: 0.9, description: 'Maximum complexity: all floors, half ceilings, mostly textured' },
];

for (const cfg of configs) {
  const mapConfig: Partial<MapGeneratorConfig> = {
    ...DEFAULT_MAP_CONFIG,
    seed: SEED,
    floorMaterialRatio: cfg.floorMaterialRatio,
    ceilingMaterialRatio: cfg.ceilingMaterialRatio,
    floorTextureRatio: cfg.floorTextureRatio,
  };

  const geometry = generateComplexMap(cfg.polygons, mapConfig);

  // Camera positioned at 25% into the map, looking forward
  const w = (mapConfig as MapGeneratorConfig).width;
  const h = (mapConfig as MapGeneratorConfig).height;
  const camera = makeCamera({ position: [w * 0.25, h * 0.25], direction: [0, 10], plane: [15, 0] });

  const mapData = { camera, geometry };
  const filePath = path.join(MAPS_DIR, `${cfg.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(mapData));

  const polyCount = geometry.polygons.length;
  const floorCount = geometry.polygons.filter(
    (p: any) => p.floorMaterial != null || p.ceilingMaterial != null
  ).length;
  console.log(`${cfg.name}: ${polyCount} polygons, ${floorCount} with floor/ceiling -> ${filePath}`);
}

console.log('Done. Generated 5 benchmark maps.');
