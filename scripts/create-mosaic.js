/**
 * Creates a mosaic image from all textures in a given directory.
 * Collects all .png files recursively, sorts them naturally,
 * arranges them in an N x N grid, and outputs a single mosaic image.
 *
 * Usage:
 *   node scripts/create-mosaic.js [input-dir] [output-file]
 *
 * Defaults:
 *   input-dir:  assets/textures/SBS - Tiny Texture Pack 512x512 B
 *   output-file: assets/textures/mosaic.png
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DEFAULT_INPUT = path.join(__dirname, '..', 'assets', 'textures', 'SBS - Tiny Texture Pack 512x512 B');
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'assets', 'textures', 'mosaic.png');

function collectPngs(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectPngs(fullPath));
    } else if (entry.isFile() && /\.png$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// Natural sort: "Roof 2" comes before "Roof 10"
function naturalCompare(a, b) {
  const nameA = path.basename(a);
  const nameB = path.basename(b);
  return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
}

async function main() {
  const inputDir = process.argv[2] || DEFAULT_INPUT;
  const outputFile = process.argv[3] || DEFAULT_OUTPUT;

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  // Collect and sort all PNG files
  const files = collectPngs(inputDir).sort(naturalCompare);
  const count = files.length;

  if (count === 0) {
    console.error('No PNG files found in', inputDir);
    process.exit(1);
  }

  console.log(`Found ${count} textures`);

  // Determine grid size (smallest N where N*N >= count)
  const gridSize = Math.ceil(Math.sqrt(count));
  console.log(`Grid size: ${gridSize} x ${gridSize}`);

  // Read the first image to determine tile dimensions
  const firstMeta = await sharp(files[0]).metadata();
  const tileW = firstMeta.width;
  const tileH = firstMeta.height;
  console.log(`Tile size: ${tileW} x ${tileH}`);

  const mosaicW = gridSize * tileW;
  const mosaicH = gridSize * tileH;
  console.log(`Mosaic size: ${mosaicW} x ${mosaicH}`);

  // Build composite operations: place each image at its grid position
  const composites = await Promise.all(
    files.map(async (file, i) => {
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);
      // Resize to exact tile dimensions in case any image differs slightly
      const buffer = await sharp(file)
        .resize(tileW, tileH, { fit: 'fill' })
        .toBuffer();
      return {
        input: buffer,
        left: col * tileW,
        top: row * tileH,
      };
    })
  );

  // Create mosaic: start with a transparent canvas, composite all tiles
  await sharp({
    create: {
      width: mosaicW,
      height: mosaicH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputFile);

  console.log(`Mosaic saved to: ${outputFile}`);
  console.log(`${count} images arranged in ${gridSize}x${gridSize} grid (${gridSize * gridSize - count} empty cells filled with black)`);
}

main().catch((err) => {
  console.error('Error creating mosaic:', err);
  process.exit(1);
});
