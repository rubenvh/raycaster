/**
 * Script to generate a stress-sized map (1000 polygons) and save it to assets/maps.
 * 
 * Run with: npx ts-node scripts/generate-stress-map.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateComplexMap, DEFAULT_MAP_CONFIG, MATERIAL_PRESETS, MapGeneratorConfig } from '../src/common/testing/map-generator';
import { Vector, normalize } from '../src/common/math/vector';

// Configuration for stress map
const STRESS_POLYGON_COUNT = 1000;
const SEED = 42;

// Use larger world size for stress map to fit more polygons
const stressMapConfig: Partial<MapGeneratorConfig> = {
  ...DEFAULT_MAP_CONFIG,
  ...MATERIAL_PRESETS.textured, // Use textured preset for visual variety
  width: 1200,
  height: 900,
  minRoomSize: 30,
  wallThickness: 3,
  doorwayWidth: 25,
  seed: SEED,
};

// Generate the map
console.log(`Generating stress map with ~${STRESS_POLYGON_COUNT} polygons...`);
const storedGeometry = generateComplexMap(STRESS_POLYGON_COUNT, stressMapConfig);
console.log(`Generated ${storedGeometry.polygons.length} polygons`);

// Count edges
let edgeCount = 0;
for (const polygon of storedGeometry.polygons) {
  edgeCount += polygon.edges.length;
}
console.log(`Total edges: ${edgeCount}`);

/**
 * Find a safe starting position by checking if a point is inside any polygon.
 * We'll try positions in a grid pattern until we find an empty spot.
 */
function findSafePosition(geometry: typeof storedGeometry, worldWidth: number, worldHeight: number): Vector {
  const margin = 10; // Stay away from boundaries
  const step = 10;   // Grid step size
  const buffer = 5;  // Buffer around walls
  
  // Helper to check if a point is inside a rectangle defined by edges (with buffer)
  function isInsidePolygon(point: Vector, edges: typeof storedGeometry.polygons[0]['edges']): boolean {
    // Get bounding box from edges
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const edge of edges) {
      const start = edge.start.vector;
      const end = edge.end.vector;
      minX = Math.min(minX, start[0], end[0]);
      minY = Math.min(minY, start[1], end[1]);
      maxX = Math.max(maxX, start[0], end[0]);
      maxY = Math.max(maxY, start[1], end[1]);
    }
    // Expanded bounding box check with buffer
    return point[0] >= minX - buffer && point[0] <= maxX + buffer && 
           point[1] >= minY - buffer && point[1] <= maxY + buffer;
  }
  
  // Search for an empty position (start from center, spiral outward)
  const centerX = worldWidth / 2;
  const centerY = worldHeight / 2;
  
  for (let radius = 0; radius < Math.max(worldWidth, worldHeight) / 2; radius += step) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x = Math.round(centerX + radius * Math.cos(angle));
      const y = Math.round(centerY + radius * Math.sin(angle));
      
      // Skip if outside world bounds
      if (x < margin || x > worldWidth - margin || y < margin || y > worldHeight - margin) continue;
      
      const point: Vector = [x, y];
      let isBlocked = false;
      
      for (const polygon of geometry.polygons) {
        if (isInsidePolygon(point, polygon.edges)) {
          isBlocked = true;
          break;
        }
      }
      
      if (!isBlocked) {
        console.log(`Found safe position at [${x}, ${y}]`);
        return point;
      }
    }
  }
  
  // Fallback - just try the center area aggressively
  console.log('Warning: Spiral search failed, trying center area');
  return [margin + 50, margin + 50];
}

// Find a safe camera position
const position = findSafePosition(storedGeometry, stressMapConfig.width!, stressMapConfig.height!);
const direction: Vector = [10, 5]; // Looking right and slightly down
const dirNorm = normalize(direction);
const plane: Vector = [dirNorm[1] * 15, -dirNorm[0] * 15]; // Perpendicular, scaled for FOV

// Build the map structure (only need position, direction, plane - makeCamera will compute the rest)
const mapData = {
  camera: {
    position,
    direction,
    plane,
  },
  geometry: storedGeometry,
};

// Write to file
const outputPath = path.join(__dirname, '..', 'assets', 'maps', 'stress-map.json');
fs.writeFileSync(outputPath, JSON.stringify(mapData));
console.log(`\nStress map saved to: ${outputPath}`);
console.log(`\nMap statistics:`);
console.log(`  - Polygons: ${storedGeometry.polygons.length}`);
console.log(`  - Edges: ${edgeCount}`);
console.log(`  - World size: ${stressMapConfig.width}x${stressMapConfig.height}`);
console.log(`  - Camera position: [${position[0].toFixed(1)}, ${position[1].toFixed(1)}]`);
