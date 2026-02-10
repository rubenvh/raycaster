/**
 * Texture loading utilities for benchmark tests.
 * 
 * Provides texture sources for both benchmark tests and application use.
 * Uses embedded base64 textures that work in both Node.js and browser environments.
 */

import { ITextureSource, ITextureReference } from '../textures/model';
import { Texture } from '../textures/texture';
import { getEmbeddedTextureSources } from '../textures/embedded-textures';

/**
 * Configuration for a texture asset.
 */
export interface TextureConfig {
  /** Path to the texture file */
  path: string;
  /** Texture ID (filename) */
  id: string;
  /** Width of each texture tile in pixels */
  textureWidth: number;
  /** Height of each texture tile in pixels */
  textureHeight: number;
}

/**
 * Texture configurations for benchmark tests.
 * These match the actual texture assets in the project.
 */
export const BENCHMARK_TEXTURES: TextureConfig[] = [
  {
    path: './assets/textures/001.jpg',
    id: '001.jpg',
    textureWidth: 192,
    textureHeight: 192,  // 768x768 total, 4x4 grid = 16 parts (indices 0-15)
  },
  {
    path: './assets/textures/wolf.png',
    id: 'wolf.png',
    textureWidth: 64,
    textureHeight: 64,   // 512x64 total, 8x1 grid = 8 parts (indices 0-7)
  },
];

/**
 * Load texture sources for use in benchmark tests and application.
 * Uses embedded base64 textures that work in both Node.js and browser environments.
 * Returns ITextureSource objects that can be used with the Texture class.
 */
export function loadTextureSources(): ITextureSource[] {
  return getEmbeddedTextureSources();
}

/**
 * Load textures as Texture objects ready for rendering.
 * Returns a Map keyed by texture ID.
 */
export function loadBenchmarkTextures(): Map<string, Texture> {
  const textures = new Map<string, Texture>();
  const sources = loadTextureSources();
  
  for (const source of sources) {
    textures.set(source.id, new Texture(source));
  }
  
  return textures;
}

/**
 * Get valid texture references for map generation.
 * These are texture IDs and indices that exist in the loaded textures.
 */
export function getValidTextureReferences(): ITextureReference[] {
  return [
    // 001.jpg has 16 parts (indices 0-15, 4x4 grid)
    { id: '001.jpg', index: 0 },
    { id: '001.jpg', index: 1 },
    { id: '001.jpg', index: 2 },
    { id: '001.jpg', index: 3 },
    { id: '001.jpg', index: 5 },
    { id: '001.jpg', index: 8 },
    { id: '001.jpg', index: 11 },
    // wolf.png has 8 parts (indices 0-7, 8x1 grid)
    { id: 'wolf.png', index: 0 },
    { id: 'wolf.png', index: 1 },
    { id: 'wolf.png', index: 2 },
    { id: 'wolf.png', index: 3 },
    { id: 'wolf.png', index: 5 },
  ];
}

/**
 * Get the number of texture parts (tiles) for a given texture ID.
 */
export function getTexturePartCount(textureId: string): number {
  const config = BENCHMARK_TEXTURES.find(t => t.id === textureId);
  if (!config) return 0;
  
  // Calculate from the known dimensions
  if (textureId === '001.jpg') return 16;  // 4x4
  if (textureId === 'wolf.png') return 8;   // 8x1
  
  return 1;
}
