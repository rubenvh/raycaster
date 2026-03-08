/**
 * Resizes a mosaic image so that each individual tile is at most
 * a given max size (default 150px) in width and height.
 *
 * It reads the mosaic, determines the original tile size from the
 * mosaic dimensions and grid size, then scales the whole image down
 * proportionally.
 *
 * Usage:
 *   node scripts/resize-mosaic.js [input-file] [output-file] [max-tile-size]
 *
 * Defaults:
 *   input-file:    assets/textures/mosaic.png
 *   output-file:   assets/textures/mosaic-small.png
 *   max-tile-size: 150
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DEFAULT_INPUT = path.join(__dirname, '..', 'assets', 'textures', 'mosaic.png');
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'assets', 'textures', 'mosaic-small.png');
const DEFAULT_MAX_TILE = 150;

async function main() {
  const inputFile = process.argv[2] || DEFAULT_INPUT;
  const outputFile = process.argv[3] || DEFAULT_OUTPUT;
  const maxTile = parseInt(process.argv[4], 10) || DEFAULT_MAX_TILE;

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const meta = await sharp(inputFile).metadata();
  console.log(`Original mosaic: ${meta.width} x ${meta.height}`);

  // The mosaic was built from 75 images in a 9x9 grid of 512x512 tiles.
  // Detect grid size: assume square mosaic where tile size divides evenly.
  // We try common tile sizes (powers of 2, known texture sizes) to find the grid.
  const knownTileSizes = [512, 256, 128, 64, 150, 100];
  let tileSize = null;
  let gridW = null;
  let gridH = null;

  for (const ts of knownTileSizes) {
    if (meta.width % ts === 0 && meta.height % ts === 0) {
      tileSize = ts;
      gridW = meta.width / ts;
      gridH = meta.height / ts;
      break;
    }
  }

  // Fallback: if mosaic is square, assume grid = gcd-based approach
  if (!tileSize) {
    // Assume square tiles, find GCD of width and height as potential tile size
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    tileSize = gcd(meta.width, meta.height);
    gridW = meta.width / tileSize;
    gridH = meta.height / tileSize;
  }

  console.log(`Detected tile size: ${tileSize} x ${tileSize}`);
  console.log(`Detected grid: ${gridW} x ${gridH}`);

  if (tileSize <= maxTile) {
    console.log(`Tiles are already ${tileSize}px, which is <= ${maxTile}px. No resizing needed.`);
    // Just copy the file
    fs.copyFileSync(inputFile, outputFile);
    console.log(`Copied to: ${outputFile}`);
    return;
  }

  // Scale factor: shrink each tile to maxTile
  const newTileSize = maxTile;
  const newWidth = gridW * newTileSize;
  const newHeight = gridH * newTileSize;

  console.log(`New tile size: ${newTileSize} x ${newTileSize}`);
  console.log(`New mosaic size: ${newWidth} x ${newHeight}`);

  await sharp(inputFile)
    .resize(newWidth, newHeight, { fit: 'fill' })
    .png()
    .toFile(outputFile);

  console.log(`Resized mosaic saved to: ${outputFile}`);
}

main().catch((err) => {
  console.error('Error resizing mosaic:', err);
  process.exit(1);
});
