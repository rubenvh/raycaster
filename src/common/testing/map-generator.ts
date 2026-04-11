/**
 * Procedural map generator for benchmark tests.
 * 
 * Generates complex maze-like geometry with configurable:
 * - Size and polygon count
 * - Texture coverage
 * - Translucent wall ratio
 * 
 * Uses recursive subdivision to create a maze with rooms and corridors.
 */

import { Vector } from '../math/vector';
import { IStoredGeometry } from '../geometry/geometry';
import { IStoredPolygon } from '../geometry/polygon';
import { IStoredEdge } from '../geometry/edge';
import { ITextureReference } from '../textures/model';
import { Color, IMaterial } from '../geometry/properties';
import { getValidTextureReferences } from './texture-loader';
import { SeededRandom } from './seeded-random';

/**
 * Configuration for the map generator.
 */
export interface MapGeneratorConfig {
  // Geometry settings
  /** World width in units */
  width: number;
  /** World height in units */
  height: number;
  /** Minimum room size before stopping subdivision */
  minRoomSize: number;
  /** Wall thickness in units */
  wallThickness: number;
  /** Doorway width in units */
  doorwayWidth: number;
  /** Random seed for reproducibility */
  seed: number;
  
  // Material settings
  /** Available textures to use on walls */
  textures: ITextureReference[];
  /** Fraction of walls that have textures (0.0 - 1.0) */
  texturedWallRatio: number;
  /** Fraction of walls that are translucent (0.0 - 1.0) */
  translucentWallRatio: number;
  /** Alpha value for translucent walls (0.0 - 1.0) */
  translucentAlpha: number;

  // Floor/ceiling material settings
  /** Fraction of polygons that have floor materials (0.0 - 1.0) */
  floorMaterialRatio: number;
  /** Fraction of polygons that have ceiling materials (0.0 - 1.0) */
  ceilingMaterialRatio: number;
  /** Fraction of floor/ceiling materials that have textures (0.0 - 1.0) */
  floorTextureRatio: number;
}

/**
 * Default configuration for map generation.
 */
export const DEFAULT_MAP_CONFIG: MapGeneratorConfig = {
  // Geometry
  width: 800,
  height: 600,
  minRoomSize: 40,
  wallThickness: 2,
  doorwayWidth: 20,
  seed: 12345,
  
  // Materials
  textures: getValidTextureReferences(),
  texturedWallRatio: 0.7,
  translucentWallRatio: 0.15,
  translucentAlpha: 0.5,

  // Floor/ceiling
  floorMaterialRatio: 0,
  ceilingMaterialRatio: 0,
  floorTextureRatio: 0,
};

/**
 * Material configuration presets for different benchmark scenarios.
 */
export const MATERIAL_PRESETS = {
  /** No textures, no translucency - fastest rendering */
  fast: {
    textures: [] as ITextureReference[],
    texturedWallRatio: 0,
    translucentWallRatio: 0,
    translucentAlpha: 1,
  },
  
  /** Heavy texture usage, no translucency */
  textured: {
    textures: getValidTextureReferences(),
    texturedWallRatio: 0.8,
    translucentWallRatio: 0,
    translucentAlpha: 1,
  },
  
  /** Many see-through walls (worst case for rendering - no early termination) */
  translucent: {
    textures: getValidTextureReferences(),
    texturedWallRatio: 0.5,
    translucentWallRatio: 0.3,
    translucentAlpha: 0.5,
  },
  
  /** Maximum complexity - heavy textures and translucency */
  stress: {
    textures: getValidTextureReferences(),
    texturedWallRatio: 0.9,
    translucentWallRatio: 0.4,
    translucentAlpha: 0.3,
  },
} as const;

export type MaterialPreset = keyof typeof MATERIAL_PRESETS;

/** A room rectangle tracked during subdivision for floor polygon generation. */
interface RoomRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Generate a complex map with the specified number of polygons.
 * 
 * @param targetPolygons - Approximate number of polygons to generate
 * @param config - Generator configuration (merged with defaults)
 * @returns Stored geometry ready for loading
 */
export function generateComplexMap(
  targetPolygons: number,
  config: Partial<MapGeneratorConfig> = {}
): IStoredGeometry {
  const cfg: MapGeneratorConfig = { ...DEFAULT_MAP_CONFIG, ...config };
  const rng = new SeededRandom(cfg.seed);
  const polygons: IStoredPolygon[] = [];
  
  // Add outer boundary walls
  addOuterBoundary(polygons, cfg, rng);
  
  // Track rooms during subdivision for floor polygon generation
  const rooms: RoomRect[] = [];

  // Add internal walls through recursive subdivision
  const margin = cfg.wallThickness * 2;
  subdivide(
    margin, margin,
    cfg.width - margin, cfg.height - margin,
    polygons, cfg, rng, targetPolygons, rooms
  );
  
  // Add some additional scattered obstacles if we haven't hit target
  while (polygons.length < targetPolygons * 0.9) {
    addRandomObstacle(polygons, cfg, rng);
  }
  
  // Add room floor/ceiling polygons after walls.
  // Room polygons are large rectangles covering the floor area of each room.
  // Their edges have no wall material (material: undefined) and immaterial: true,
  // so they don't render as walls. The floor renderer uses polygon.floorMaterial
  // and polygon.ceilingMaterial for per-pixel rendering.
  if (cfg.floorMaterialRatio > 0 || cfg.ceilingMaterialRatio > 0) {
    for (const room of rooms) {
      const hasFloor = cfg.floorMaterialRatio > 0 && rng.nextBool(cfg.floorMaterialRatio);
      const hasCeiling = cfg.ceilingMaterialRatio > 0 && rng.nextBool(cfg.ceilingMaterialRatio);
      if (!hasFloor && !hasCeiling) continue;

      const roomPoly = createRoomPolygon(room.x1, room.y1, room.x2, room.y2, cfg, rng, hasFloor, hasCeiling);
      polygons.push(roomPoly);
    }
  }

  return { polygons };
}

/**
 * Add the outer boundary walls of the map.
 */
function addOuterBoundary(
  polygons: IStoredPolygon[],
  cfg: MapGeneratorConfig,
  rng: SeededRandom
): void {
  const t = cfg.wallThickness;
  const w = cfg.width;
  const h = cfg.height;
  
  // Four walls as separate polygons (so they can have different materials)
  // Top wall
  polygons.push(createRectPolygon(0, 0, w, t, cfg, rng));
  // Bottom wall
  polygons.push(createRectPolygon(0, h - t, w, h, cfg, rng));
  // Left wall
  polygons.push(createRectPolygon(0, t, t, h - t, cfg, rng));
  // Right wall
  polygons.push(createRectPolygon(w - t, t, w, h - t, cfg, rng));
}

/**
 * Recursively subdivide the space to create rooms and corridors.
 * Leaf rooms (those that can't be further subdivided) are collected in the rooms array.
 */
function subdivide(
  x1: number, y1: number,
  x2: number, y2: number,
  polygons: IStoredPolygon[],
  cfg: MapGeneratorConfig,
  rng: SeededRandom,
  targetPolygons: number,
  rooms: RoomRect[]
): void {
  // Stop if we have enough polygons
  if (polygons.length >= targetPolygons) {
    rooms.push({ x1, y1, x2, y2 });
    return;
  }
  
  const width = x2 - x1;
  const height = y2 - y1;
  
  // Stop if room is too small to subdivide — this is a leaf room
  if (width < cfg.minRoomSize * 2 && height < cfg.minRoomSize * 2) {
    rooms.push({ x1, y1, x2, y2 });
    return;
  }
  
  // Decide split direction based on room proportions
  const splitHorizontal = height > width || (height === width && rng.nextBool());
  
  if (splitHorizontal && height >= cfg.minRoomSize * 2) {
    // Horizontal split (wall runs left-right)
    const splitY = rng.nextInt(
      Math.floor(y1 + cfg.minRoomSize),
      Math.floor(y2 - cfg.minRoomSize)
    );
    
    // Create wall with doorway
    const doorX = rng.nextInt(
      Math.floor(x1 + cfg.doorwayWidth),
      Math.floor(x2 - cfg.doorwayWidth * 2)
    );
    
    addWallWithDoorway(
      x1, splitY, x2, splitY + cfg.wallThickness,
      doorX, cfg.doorwayWidth, true,
      polygons, cfg, rng
    );
    
    // Recurse into sub-rooms
    subdivide(x1, y1, x2, splitY, polygons, cfg, rng, targetPolygons, rooms);
    subdivide(x1, splitY + cfg.wallThickness, x2, y2, polygons, cfg, rng, targetPolygons, rooms);
    
  } else if (width >= cfg.minRoomSize * 2) {
    // Vertical split (wall runs top-bottom)
    const splitX = rng.nextInt(
      Math.floor(x1 + cfg.minRoomSize),
      Math.floor(x2 - cfg.minRoomSize)
    );
    
    // Create wall with doorway
    const doorY = rng.nextInt(
      Math.floor(y1 + cfg.doorwayWidth),
      Math.floor(y2 - cfg.doorwayWidth * 2)
    );
    
    addWallWithDoorway(
      splitX, y1, splitX + cfg.wallThickness, y2,
      doorY, cfg.doorwayWidth, false,
      polygons, cfg, rng
    );
    
    // Recurse into sub-rooms
    subdivide(x1, y1, splitX, y2, polygons, cfg, rng, targetPolygons, rooms);
    subdivide(splitX + cfg.wallThickness, y1, x2, y2, polygons, cfg, rng, targetPolygons, rooms);
  } else {
    // Can't split in preferred direction — this is a leaf room
    rooms.push({ x1, y1, x2, y2 });
  }
}

/**
 * Add a wall with a doorway (creates two wall segments).
 */
function addWallWithDoorway(
  x1: number, y1: number, x2: number, y2: number,
  doorPos: number, doorWidth: number, horizontal: boolean,
  polygons: IStoredPolygon[],
  cfg: MapGeneratorConfig,
  rng: SeededRandom
): void {
  if (horizontal) {
    // Wall segments before and after doorway
    if (doorPos > x1 + cfg.wallThickness) {
      polygons.push(createRectPolygon(x1, y1, doorPos, y2, cfg, rng));
    }
    if (doorPos + doorWidth < x2 - cfg.wallThickness) {
      polygons.push(createRectPolygon(doorPos + doorWidth, y1, x2, y2, cfg, rng));
    }
  } else {
    // Vertical wall with doorway
    if (doorPos > y1 + cfg.wallThickness) {
      polygons.push(createRectPolygon(x1, y1, x2, doorPos, cfg, rng));
    }
    if (doorPos + doorWidth < y2 - cfg.wallThickness) {
      polygons.push(createRectPolygon(x1, doorPos + doorWidth, x2, y2, cfg, rng));
    }
  }
}

/**
 * Add a random rectangular obstacle.
 */
function addRandomObstacle(
  polygons: IStoredPolygon[],
  cfg: MapGeneratorConfig,
  rng: SeededRandom
): void {
  const margin = cfg.wallThickness * 4;
  const minSize = cfg.wallThickness * 2;
  const maxSize = cfg.minRoomSize / 2;
  
  const w = rng.nextInt(minSize, maxSize);
  const h = rng.nextInt(minSize, maxSize);
  const x = rng.nextInt(margin, cfg.width - margin - w);
  const y = rng.nextInt(margin, cfg.height - margin - h);
  
  polygons.push(createRectPolygon(x, y, x + w, y + h, cfg, rng));
}

/**
 * Create a rectangular polygon with generated materials.
 * Wall polygons — used for actual walls with visible edges.
 */
function createRectPolygon(
  x1: number, y1: number, x2: number, y2: number,
  cfg: MapGeneratorConfig,
  rng: SeededRandom
): IStoredPolygon {
  // Create 4 edges for the rectangle (clockwise)
  const edges: IStoredEdge[] = [
    createEdge([x1, y1], [x2, y1], cfg, rng), // Top
    createEdge([x2, y1], [x2, y2], cfg, rng), // Right
    createEdge([x2, y2], [x1, y2], cfg, rng), // Bottom
    createEdge([x1, y2], [x1, y1], cfg, rng), // Left
  ];
  
  return { edges };
}

/**
 * Create a room polygon with floor/ceiling materials.
 * Room polygons represent the floor/ceiling area of a room.
 * Their edges have no wall material (invisible) and are immaterial (no collision),
 * so they only contribute floor/ceiling surfaces to the renderer.
 */
function createRoomPolygon(
  x1: number, y1: number, x2: number, y2: number,
  cfg: MapGeneratorConfig,
  rng: SeededRandom,
  hasFloor: boolean,
  hasCeiling: boolean,
): IStoredPolygon {
  // Create 4 edges with no wall material and immaterial flag
  const edges: IStoredEdge[] = [
    createInvisibleEdge([x1, y1], [x2, y1]), // Top
    createInvisibleEdge([x2, y1], [x2, y2]), // Right
    createInvisibleEdge([x2, y2], [x1, y2]), // Bottom
    createInvisibleEdge([x1, y2], [x1, y1]), // Left
  ];
  
  const polygon: IStoredPolygon = { edges };

  if (hasFloor) {
    polygon.floorMaterial = createFloorCeilingMaterial(cfg, rng);
  }
  if (hasCeiling) {
    polygon.ceilingMaterial = createFloorCeilingMaterial(cfg, rng);
  }

  return polygon;
}

/**
 * Create an invisible, immaterial edge (no wall rendering, no collision).
 * Used for room floor/ceiling polygons whose edges shouldn't be visible.
 */
function createInvisibleEdge(start: Vector, end: Vector): IStoredEdge {
  return {
    start: { vector: start },
    end: { vector: end },
    immaterial: true,
    // No material — edge won't render as a wall (material == null check in renderer)
  };
}

/**
 * Create a single edge with generated material.
 */
function createEdge(
  start: Vector,
  end: Vector,
  cfg: MapGeneratorConfig,
  rng: SeededRandom
): IStoredEdge {
  const material = createMaterial(cfg, rng);
  
  return {
    start: { vector: start },
    end: { vector: end },
    material,
  };
}

/**
 * Create a material based on configuration and random choices.
 */
function createMaterial(
  cfg: MapGeneratorConfig,
  rng: SeededRandom
): { color: Color; texture?: ITextureReference } {
  const isTranslucent = rng.nextBool(cfg.translucentWallRatio);
  const hasTexture = cfg.textures.length > 0 && rng.nextBool(cfg.texturedWallRatio);
  
  // Generate random base color
  const r = rng.nextInt(60, 200);
  const g = rng.nextInt(60, 200);
  const b = rng.nextInt(60, 200);
  const alpha = isTranslucent ? cfg.translucentAlpha : 1;
  
  const material: { color: Color; texture?: ITextureReference } = {
    color: [r, g, b, alpha],
  };
  
  if (hasTexture) {
    const textureIndex = rng.nextInt(0, cfg.textures.length - 1);
    material.texture = { ...cfg.textures[textureIndex] };
  }
  
  return material;
}

/**
 * Create a floor or ceiling material with optional texture.
 */
function createFloorCeilingMaterial(
  cfg: MapGeneratorConfig,
  rng: SeededRandom
): IMaterial {
  const r = rng.nextInt(40, 180);
  const g = rng.nextInt(40, 180);
  const b = rng.nextInt(40, 180);
  
  const material: IMaterial = {
    color: [r, g, b, 1],
  };
  
  if (cfg.textures.length > 0 && cfg.floorTextureRatio > 0 && rng.nextBool(cfg.floorTextureRatio)) {
    const textureIndex = rng.nextInt(0, cfg.textures.length - 1);
    material.texture = { ...cfg.textures[textureIndex] };
  }
  
  return material;
}

/**
 * Get a camera starting position that's likely to be inside the map.
 */
export function getStartingPosition(cfg: MapGeneratorConfig): Vector {
  // Start near the center, slightly offset
  return [cfg.width * 0.25, cfg.height * 0.25];
}
