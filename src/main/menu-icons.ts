import { nativeImage, NativeImage } from 'electron';

// Generate 16x16 menu icons programmatically using raw RGBA pixel buffers.
// Each icon uses simple geometric shapes to visually represent the operation.

const SIZE = 16;

type RGBA = [number, number, number, number];

const WHITE: RGBA = [220, 220, 220, 255];
const CYAN: RGBA = [80, 200, 220, 255];
const ORANGE: RGBA = [240, 160, 60, 255];
const GREEN: RGBA = [80, 200, 100, 255];
const RED: RGBA = [220, 80, 80, 255];
const YELLOW: RGBA = [220, 200, 60, 255];
const DIM: RGBA = [120, 120, 120, 255];

class PixelCanvas {
  private data: Uint8Array;
  constructor(private w = SIZE, private h = SIZE) {
    this.data = new Uint8Array(w * h * 4);
  }

  setPixel(x: number, y: number, [r, g, b, a]: RGBA) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = a;
  }

  line(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    // Bresenham's line
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this.setPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  rect(x: number, y: number, w: number, h: number, color: RGBA) {
    this.line(x, y, x + w - 1, y, color);
    this.line(x + w - 1, y, x + w - 1, y + h - 1, color);
    this.line(x + w - 1, y + h - 1, x, y + h - 1, color);
    this.line(x, y + h - 1, x, y, color);
  }

  fillRect(x: number, y: number, w: number, h: number, color: RGBA) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        this.setPixel(x + dx, y + dy, color);
  }

  polygon(points: [number, number][], color: RGBA) {
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      this.line(x0, y0, x1, y1, color);
    }
  }

  circle(cx: number, cy: number, r: number, color: RGBA) {
    // Midpoint circle
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      this.setPixel(cx + x, cy + y, color);
      this.setPixel(cx - x, cy + y, color);
      this.setPixel(cx + x, cy - y, color);
      this.setPixel(cx - x, cy - y, color);
      this.setPixel(cx + y, cy + x, color);
      this.setPixel(cx - y, cy + x, color);
      this.setPixel(cx + y, cy - x, color);
      this.setPixel(cx - y, cy - x, color);
      y++;
      if (err < 0) { err += 2 * y + 1; }
      else { x--; err += 2 * (y - x) + 1; }
    }
  }

  dot(x: number, y: number, color: RGBA) {
    this.setPixel(x, y, color);
    this.setPixel(x + 1, y, color);
    this.setPixel(x, y + 1, color);
    this.setPixel(x + 1, y + 1, color);
  }

  arrow(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
    this.line(x0, y0, x1, y1, color);
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;
    const px = -uy, py = ux;
    const hl = 3; // arrowhead length
    this.line(x1, y1, Math.round(x1 - ux * hl + px * 2), Math.round(y1 - uy * hl + py * 2), color);
    this.line(x1, y1, Math.round(x1 - ux * hl - px * 2), Math.round(y1 - uy * hl - py * 2), color);
  }

  toNativeImage(): NativeImage {
    return nativeImage.createFromBuffer(Buffer.from(this.data.buffer), { width: this.w, height: this.h });
  }
}

// --- Polygon operations ---

function iconCreatePolygon(): NativeImage {
  const c = new PixelCanvas();
  c.polygon([[3, 12], [1, 5], [8, 1], [14, 5], [12, 12]], CYAN);
  c.dot(8, 14, GREEN); // "+" hint
  return c.toNativeImage();
}

function iconClonePolygon(): NativeImage {
  const c = new PixelCanvas();
  c.rect(1, 3, 9, 9, DIM);
  c.rect(5, 1, 9, 9, CYAN);
  return c.toNativeImage();
}

function iconExpandPolygon(): NativeImage {
  const c = new PixelCanvas();
  c.rect(4, 4, 8, 8, DIM);
  c.line(4, 4, 1, 1, ORANGE);
  c.line(12, 4, 14, 1, ORANGE);
  c.line(12, 12, 14, 14, ORANGE);
  c.line(4, 12, 1, 14, ORANGE);
  return c.toNativeImage();
}

function iconSplitPolygon(): NativeImage {
  const c = new PixelCanvas();
  c.rect(1, 2, 14, 12, DIM);
  c.line(8, 2, 8, 14, RED);
  return c.toNativeImage();
}

function iconRotatePolygon(): NativeImage {
  const c = new PixelCanvas();
  // Curved arrow
  for (let a = 0; a < 270; a += 10) {
    const r = (a * Math.PI) / 180;
    c.setPixel(Math.round(8 + 5 * Math.cos(r)), Math.round(8 + 5 * Math.sin(r)), CYAN);
  }
  c.arrow(8 + 5, 8, 8 + 5, 5, CYAN);
  return c.toNativeImage();
}

function iconReversePolygon(): NativeImage {
  const c = new PixelCanvas();
  c.polygon([[2, 12], [2, 4], [8, 1], [14, 4], [14, 12]], CYAN);
  c.arrow(5, 5, 11, 5, ORANGE);
  c.arrow(11, 10, 5, 10, ORANGE);
  return c.toNativeImage();
}

function iconFlipH(): NativeImage {
  const c = new PixelCanvas();
  c.line(8, 1, 8, 14, DIM);
  c.polygon([[2, 4], [6, 4], [6, 12], [2, 12]], CYAN);
  c.polygon([[10, 4], [14, 4], [14, 12], [10, 12]], ORANGE);
  c.arrow(5, 3, 11, 3, WHITE);
  return c.toNativeImage();
}

function iconFlipV(): NativeImage {
  const c = new PixelCanvas();
  c.line(1, 8, 14, 8, DIM);
  c.polygon([[3, 2], [13, 2], [13, 6], [3, 6]], CYAN);
  c.polygon([[3, 10], [13, 10], [13, 14], [3, 14]], ORANGE);
  c.arrow(2, 5, 2, 11, WHITE);
  return c.toNativeImage();
}

function iconScaleUp(): NativeImage {
  const c = new PixelCanvas();
  c.rect(4, 4, 8, 8, DIM);
  c.rect(2, 2, 12, 12, CYAN);
  c.line(7, 1, 9, 1, GREEN);
  c.line(8, 0, 8, 2, GREEN); // "+" sign
  return c.toNativeImage();
}

function iconScaleDown(): NativeImage {
  const c = new PixelCanvas();
  c.rect(2, 2, 12, 12, DIM);
  c.rect(4, 4, 8, 8, CYAN);
  c.line(7, 1, 9, 1, RED); // "-" sign
  return c.toNativeImage();
}

function iconRegularize(): NativeImage {
  const c = new PixelCanvas();
  // Irregular -> regular hexagon
  c.polygon([[8, 1], [14, 5], [14, 11], [8, 15], [2, 11], [2, 5]], CYAN);
  return c.toNativeImage();
}

function iconConvexHull(): NativeImage {
  const c = new PixelCanvas();
  // Outer hull
  c.polygon([[2, 13], [1, 6], [6, 1], [13, 2], [14, 10], [9, 14]], GREEN);
  // Inner points
  c.dot(5, 7, DIM);
  c.dot(9, 5, DIM);
  c.dot(7, 10, DIM);
  return c.toNativeImage();
}

function iconInsetPolygon(): NativeImage {
  const c = new PixelCanvas();
  c.rect(1, 1, 14, 14, DIM);
  c.rect(4, 4, 8, 8, CYAN);
  c.line(1, 1, 4, 4, DIM);
  c.line(14, 1, 11, 4, DIM);
  c.line(14, 14, 11, 11, DIM);
  c.line(1, 14, 4, 11, DIM);
  return c.toNativeImage();
}

function iconMergePolygons(): NativeImage {
  const c = new PixelCanvas();
  c.rect(1, 3, 8, 10, CYAN);
  c.rect(7, 3, 8, 10, ORANGE);
  // Merge arrows
  c.arrow(3, 1, 10, 1, GREEN);
  return c.toNativeImage();
}

function iconGeneratePolygon(): NativeImage {
  const c = new PixelCanvas();
  // Regular hexagon with center dot
  c.polygon([[8, 1], [14, 5], [14, 11], [8, 15], [2, 11], [2, 5]], GREEN);
  c.dot(7, 7, YELLOW);
  return c.toNativeImage();
}

// --- Alignment ---

function iconAlignTop(): NativeImage {
  const c = new PixelCanvas();
  c.line(1, 2, 14, 2, WHITE);
  c.fillRect(2, 3, 5, 8, CYAN);
  c.fillRect(9, 3, 5, 5, ORANGE);
  return c.toNativeImage();
}

function iconAlignBottom(): NativeImage {
  const c = new PixelCanvas();
  c.line(1, 13, 14, 13, WHITE);
  c.fillRect(2, 5, 5, 8, CYAN);
  c.fillRect(9, 8, 5, 5, ORANGE);
  return c.toNativeImage();
}

function iconAlignLeft(): NativeImage {
  const c = new PixelCanvas();
  c.line(2, 1, 2, 14, WHITE);
  c.fillRect(3, 2, 8, 5, CYAN);
  c.fillRect(3, 9, 5, 5, ORANGE);
  return c.toNativeImage();
}

function iconAlignRight(): NativeImage {
  const c = new PixelCanvas();
  c.line(13, 1, 13, 14, WHITE);
  c.fillRect(5, 2, 8, 5, CYAN);
  c.fillRect(8, 9, 5, 5, ORANGE);
  return c.toNativeImage();
}

function iconAlignCenterH(): NativeImage {
  const c = new PixelCanvas();
  c.line(8, 1, 8, 14, DIM);
  c.fillRect(3, 2, 10, 4, CYAN);
  c.fillRect(5, 9, 6, 4, ORANGE);
  return c.toNativeImage();
}

function iconAlignCenterV(): NativeImage {
  const c = new PixelCanvas();
  c.line(1, 8, 14, 8, DIM);
  c.fillRect(2, 3, 4, 10, CYAN);
  c.fillRect(9, 5, 4, 6, ORANGE);
  return c.toNativeImage();
}

// --- Edge operations ---

function iconSplitEdge(): NativeImage {
  const c = new PixelCanvas();
  c.line(2, 8, 14, 8, CYAN);
  c.dot(7, 7, RED);
  return c.toNativeImage();
}

function iconSubdivideEdge(): NativeImage {
  const c = new PixelCanvas();
  c.line(1, 8, 14, 8, CYAN);
  c.dot(4, 7, ORANGE);
  c.dot(8, 7, ORANGE);
  c.dot(11, 7, ORANGE);
  return c.toNativeImage();
}

function iconInsetEdge(): NativeImage {
  const c = new PixelCanvas();
  c.line(1, 12, 5, 12, CYAN);
  c.line(5, 12, 5, 5, ORANGE);
  c.line(5, 5, 11, 5, ORANGE);
  c.line(11, 5, 11, 12, ORANGE);
  c.line(11, 12, 14, 12, CYAN);
  return c.toNativeImage();
}

function iconImmaterial(): NativeImage {
  const c = new PixelCanvas();
  // Dashed line
  for (let x = 1; x < 15; x += 3) {
    c.line(x, 8, Math.min(x + 1, 14), 8, CYAN);
  }
  return c.toNativeImage();
}

function iconTexture(): NativeImage {
  const c = new PixelCanvas();
  c.rect(2, 2, 12, 12, CYAN);
  // Grid pattern inside
  c.line(6, 2, 6, 13, DIM);
  c.line(10, 2, 10, 13, DIM);
  c.line(2, 6, 13, 6, DIM);
  c.line(2, 10, 13, 10, DIM);
  return c.toNativeImage();
}

function iconTranslucency(): NativeImage {
  const c = new PixelCanvas();
  c.rect(2, 2, 12, 12, CYAN);
  // Gradient dots
  for (let y = 3; y < 13; y += 2)
    for (let x = 3; x < 13; x += 2)
      c.setPixel(x, y, [220, 220, 220, Math.round(255 * (x - 2) / 11)]);
  return c.toNativeImage();
}

// --- Vertex operations ---

function iconBevelVertex(): NativeImage {
  const c = new PixelCanvas();
  c.line(2, 14, 2, 4, CYAN);
  c.line(2, 4, 6, 2, ORANGE); // bevel
  c.line(6, 2, 14, 2, CYAN);
  c.dot(1, 3, DIM); // original corner
  return c.toNativeImage();
}

function iconAlignVerticesH(): NativeImage {
  const c = new PixelCanvas();
  c.line(1, 8, 14, 8, DIM);
  c.dot(3, 4, CYAN); c.arrow(4, 5, 4, 7, CYAN);
  c.dot(7, 11, ORANGE); c.arrow(8, 10, 8, 8, ORANGE);
  c.dot(11, 3, GREEN); c.arrow(12, 4, 12, 7, GREEN);
  return c.toNativeImage();
}

function iconAlignVerticesV(): NativeImage {
  const c = new PixelCanvas();
  c.line(8, 1, 8, 14, DIM);
  c.dot(3, 3, CYAN); c.arrow(4, 4, 7, 4, CYAN);
  c.dot(12, 7, ORANGE); c.arrow(11, 8, 9, 8, ORANGE);
  c.dot(4, 11, GREEN); c.arrow(5, 12, 7, 12, GREEN);
  return c.toNativeImage();
}

function iconWeldVertices(): NativeImage {
  const c = new PixelCanvas();
  c.dot(3, 7, CYAN);
  c.dot(12, 7, ORANGE);
  c.arrow(5, 8, 7, 8, CYAN);
  c.arrow(11, 8, 9, 8, ORANGE);
  c.dot(7, 7, GREEN); // merged point
  return c.toNativeImage();
}

// --- Misc ---

function iconRemove(): NativeImage {
  const c = new PixelCanvas();
  c.line(3, 3, 13, 13, RED);
  c.line(13, 3, 3, 13, RED);
  return c.toNativeImage();
}

function iconBsp(): NativeImage {
  const c = new PixelCanvas();
  c.line(8, 1, 8, 14, GREEN);
  c.line(2, 4, 8, 4, CYAN);
  c.line(8, 10, 14, 10, ORANGE);
  return c.toNativeImage();
}

function iconFadeStrategy(): NativeImage {
  const c = new PixelCanvas();
  for (let x = 1; x < 15; x++) {
    const h = Math.round(12 * (1 - x / 15));
    c.line(x, 14 - h, x, 14, [80, 200, 220, Math.round(255 * (1 - x / 15))]);
  }
  return c.toNativeImage();
}

// Cache icons so they're only generated once
let _cache: Record<string, NativeImage> | null = null;

function getIcons(): Record<string, NativeImage> {
  if (_cache) return _cache;
  _cache = {
    createPolygon: iconCreatePolygon(),
    clonePolygon: iconClonePolygon(),
    expandPolygon: iconExpandPolygon(),
    splitPolygon: iconSplitPolygon(),
    rotatePolygon: iconRotatePolygon(),
    reversePolygon: iconReversePolygon(),
    flipH: iconFlipH(),
    flipV: iconFlipV(),
    scaleUp: iconScaleUp(),
    scaleDown: iconScaleDown(),
    regularize: iconRegularize(),
    convexHull: iconConvexHull(),
    insetPolygon: iconInsetPolygon(),
    mergePolygons: iconMergePolygons(),
    generatePolygon: iconGeneratePolygon(),
    alignTop: iconAlignTop(),
    alignBottom: iconAlignBottom(),
    alignLeft: iconAlignLeft(),
    alignRight: iconAlignRight(),
    alignCenterH: iconAlignCenterH(),
    alignCenterV: iconAlignCenterV(),
    splitEdge: iconSplitEdge(),
    subdivideEdge: iconSubdivideEdge(),
    insetEdge: iconInsetEdge(),
    immaterial: iconImmaterial(),
    texture: iconTexture(),
    translucency: iconTranslucency(),
    bevelVertex: iconBevelVertex(),
    alignVerticesH: iconAlignVerticesH(),
    alignVerticesV: iconAlignVerticesV(),
    weldVertices: iconWeldVertices(),
    remove: iconRemove(),
    bsp: iconBsp(),
    fadeStrategy: iconFadeStrategy(),
  };
  return _cache;
}

export default getIcons;
