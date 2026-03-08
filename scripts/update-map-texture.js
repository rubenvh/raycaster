/**
 * Updates aline2.json to use mosaic-small.png instead of mosaic.png.
 *
 * - Replaces the texture source entry: id, base64 data, dimensions
 * - Updates all edge material texture references from mosaic.png -> mosaic-small.png
 *
 * Usage:
 *   node scripts/update-map-texture.js
 */

const fs = require('fs');
const path = require('path');

const MAP_FILE = path.join(__dirname, '..', 'assets', 'maps', 'aline2.json');
const MOSAIC_SMALL = path.join(__dirname, '..', 'assets', 'textures', 'mosaic-small.png');

const OLD_ID = 'mosaic.png';
const NEW_ID = 'mosaic-small.png';

// New tile/total dimensions for mosaic-small.png (9x9 grid of 150px tiles)
const NEW_TILE_SIZE = 150;
const GRID_SIZE = 9;
const NEW_TOTAL = NEW_TILE_SIZE * GRID_SIZE; // 1350

function updateTextureRefs(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  let count = 0;
  if (obj.texture && obj.texture.id === OLD_ID) {
    obj.texture.id = NEW_ID;
    count++;
  }
  for (const v of Object.values(obj)) {
    count += updateTextureRefs(v);
  }
  return count;
}

async function main() {
  // Read the mosaic-small.png as base64
  console.log(`Reading ${MOSAIC_SMALL}...`);
  const imageBuffer = fs.readFileSync(MOSAIC_SMALL);
  const base64Data = imageBuffer.toString('base64');
  console.log(`  Base64 length: ${base64Data.length} chars`);

  // Read and parse the map
  console.log(`Reading ${MAP_FILE}...`);
  const mapData = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

  // Find and update the mosaic texture source
  const texSources = mapData.textureSources;
  let found = false;
  for (const ts of texSources) {
    if (ts.id === OLD_ID) {
      console.log(`Found texture source "${OLD_ID}":`);
      console.log(`  Old: ${ts.textureWidth}x${ts.textureHeight} tile, ${ts.totalWidth}x${ts.totalHeight} total, ${ts.data.length} chars base64`);

      ts.id = NEW_ID;
      ts.data = base64Data;
      ts.mimeType = 'image/png';
      ts.textureWidth = NEW_TILE_SIZE;
      ts.textureHeight = NEW_TILE_SIZE;
      ts.totalWidth = NEW_TOTAL;
      ts.totalHeight = NEW_TOTAL;

      console.log(`  New: ${ts.textureWidth}x${ts.textureHeight} tile, ${ts.totalWidth}x${ts.totalHeight} total, ${ts.data.length} chars base64`);
      found = true;
      break;
    }
  }

  if (!found) {
    console.error(`Texture source "${OLD_ID}" not found in map!`);
    process.exit(1);
  }

  // Update all edge texture references in geometry
  const refCount = updateTextureRefs(mapData.geometry);
  console.log(`Updated ${refCount} texture references in geometry (${OLD_ID} -> ${NEW_ID})`);

  // Also update BSP tree if it contains texture references
  const bspRefCount = updateTextureRefs(mapData.bsp);
  if (bspRefCount > 0) {
    console.log(`Updated ${bspRefCount} texture references in BSP tree`);
  }

  // Write the updated map
  console.log(`Writing updated map to ${MAP_FILE}...`);
  fs.writeFileSync(MAP_FILE, JSON.stringify(mapData));
  console.log('Done!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
