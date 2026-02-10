/**
 * Camera path system for benchmark tests.
 * 
 * Generates deterministic camera paths through geometry for reproducible
 * performance testing. Supports waypoint-based movement with interpolation.
 */

import { Vector, add, scale, subtract, normalize, norm } from '../math/vector';
import { ICamera, makeCamera } from '../camera';
import { IGeometry } from '../geometry/geometry';

/**
 * A single waypoint on the camera path.
 */
export interface Waypoint {
  /** Camera position in world coordinates */
  position: Vector;
  /** Camera direction vector (not normalized) */
  direction: Vector;
  /** Camera plane vector (defines FOV width) */
  plane: Vector;
}

/**
 * A complete camera path with multiple waypoints.
 */
export interface CameraPath {
  /** Ordered list of waypoints */
  waypoints: Waypoint[];
  /** Number of frames to spend moving between each pair of waypoints */
  framesPerSegment: number;
}

/**
 * Seeded random for reproducible waypoint generation.
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Generate a camera path that moves through the geometry.
 * 
 * @param geometry - The geometry to generate a path through
 * @param waypointCount - Number of waypoints to generate
 * @param framesPerSegment - Frames to interpolate between waypoints
 * @param seed - Random seed for reproducibility
 * @returns A camera path
 */
export function generateCameraPath(
  geometry: IGeometry,
  waypointCount: number = 10,
  framesPerSegment: number = 10,
  seed: number = 42
): CameraPath {
  const rng = new SeededRandom(seed);
  const bounds = geometry.bounds;
  const margin = 50; // Stay away from edges
  
  const waypoints: Waypoint[] = [];
  
  for (let i = 0; i < waypointCount; i++) {
    // Generate position within bounds
    const x = margin + rng.next() * Math.max(0, bounds[0] - 2 * margin);
    const y = margin + rng.next() * Math.max(0, bounds[1] - 2 * margin);
    
    // Generate random direction (angle in radians)
    const angle = rng.next() * Math.PI * 2;
    const dirLength = 10; // Standard direction length
    const planeLength = 15; // Standard plane length (affects FOV)
    
    waypoints.push({
      position: [x, y],
      direction: [Math.cos(angle) * dirLength, Math.sin(angle) * dirLength],
      // Plane is perpendicular to direction (90° clockwise, pointing RIGHT)
      plane: [Math.cos(angle - Math.PI / 2) * planeLength, Math.sin(angle - Math.PI / 2) * planeLength],
    });
  }
  
  return { waypoints, framesPerSegment };
}

/**
 * Generate a camera path that follows a specific route.
 * Useful for testing specific scenarios.
 * 
 * @param waypoints - Explicit waypoints to use
 * @param framesPerSegment - Frames between waypoints
 * @returns A camera path
 */
export function createCameraPath(
  waypoints: Waypoint[],
  framesPerSegment: number = 10
): CameraPath {
  return { waypoints, framesPerSegment };
}

/**
 * Get the total number of frames in a camera path.
 */
export function getTotalFrames(path: CameraPath): number {
  if (path.waypoints.length < 2) return path.waypoints.length;
  return path.waypoints.length * path.framesPerSegment;
}

/**
 * Linear interpolation between two vectors.
 */
function lerp(a: Vector, b: Vector, t: number): Vector {
  return add(a, scale(t, subtract(b, a)));
}

/**
 * Get the camera configuration at a specific frame.
 * 
 * @param path - The camera path
 * @param frame - Frame number (0-indexed)
 * @returns Camera configuration for that frame
 */
export function getCameraAtFrame(path: CameraPath, frame: number): ICamera {
  const { waypoints, framesPerSegment } = path;
  
  if (waypoints.length === 0) {
    // Return default camera if no waypoints
    return makeCamera({
      position: [50, 50],
      direction: [0, 10],
      plane: [15, 0],
    });
  }
  
  if (waypoints.length === 1) {
    // Single waypoint - no interpolation
    return makeCamera(waypoints[0]);
  }
  
  // Calculate total frames and wrap around
  const totalFrames = getTotalFrames(path);
  const normalizedFrame = frame % totalFrames;
  
  // Determine which segment we're in
  const segmentIndex = Math.floor(normalizedFrame / framesPerSegment);
  const segmentProgress = (normalizedFrame % framesPerSegment) / framesPerSegment;
  
  // Get the two waypoints to interpolate between
  const fromIndex = segmentIndex % waypoints.length;
  const toIndex = (segmentIndex + 1) % waypoints.length;
  const from = waypoints[fromIndex];
  const to = waypoints[toIndex];
  
  // Interpolate all camera properties
  return makeCamera({
    position: lerp(from.position, to.position, segmentProgress),
    direction: lerp(from.direction, to.direction, segmentProgress),
    plane: lerp(from.plane, to.plane, segmentProgress),
  });
}

/**
 * Generate a simple circular camera path around a center point.
 * Good for testing consistent view of geometry from all angles.
 * 
 * @param center - Center point to orbit around
 * @param radius - Distance from center
 * @param waypointCount - Number of waypoints around the circle
 * @param framesPerSegment - Frames between waypoints
 * @returns A circular camera path
 */
export function generateCircularPath(
  center: Vector,
  radius: number,
  waypointCount: number = 8,
  framesPerSegment: number = 10
): CameraPath {
  const waypoints: Waypoint[] = [];
  
  for (let i = 0; i < waypointCount; i++) {
    const angle = (i / waypointCount) * Math.PI * 2;
    
    // Position on circle
    const x = center[0] + Math.cos(angle) * radius;
    const y = center[1] + Math.sin(angle) * radius;
    
    // Direction points toward center
    const toCenter = subtract(center, [x, y]);
    const dirLength = norm(toCenter);
    const direction: Vector = dirLength > 0 
      ? scale(10, normalize(toCenter))
      : [0, 10];
    
    // Plane is perpendicular to direction (90° clockwise, pointing RIGHT)
    const plane: Vector = [-direction[1] * 1.5, direction[0] * 1.5];
    
    waypoints.push({ position: [x, y], direction, plane });
  }
  
  return { waypoints, framesPerSegment };
}
