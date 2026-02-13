/**
 * Factory for creating ICamera test data.
 */
import { Factory } from 'fishery';
import { ICamera, makeCamera } from '../../camera';
import { Vector, normalize, perpendicular, subtract, add, scale, rotate } from '../../math/vector';
import { testRandom } from '../seeded-random';

/**
 * Generate a random position within bounds.
 */
const randomPosition = (minX = 10, maxX = 90, minY = 10, maxY = 90): Vector => [
    testRandom.nextFloat(minX, maxX),
    testRandom.nextFloat(minY, maxY)
];

/**
 * Generate a random direction vector (normalized).
 */
const randomDirection = (): Vector => {
    const angle = testRandom.nextFloat(0, 2 * Math.PI);
    return [Math.cos(angle), Math.sin(angle)];
};

class CameraFactory extends Factory<ICamera> {
    /**
     * Create a camera at a specific position.
     */
    at(x: number, y: number) {
        return this.afterBuild(camera => {
            const newCam = makeCamera({
                position: [x, y],
                direction: camera.direction,
                plane: camera.plane
            });
            Object.assign(camera, newCam);
        });
    }

    /**
     * Create a camera looking in a specific direction.
     */
    lookingToward(direction: Vector) {
        return this.afterBuild(camera => {
            const normalizedDir = normalize(direction);
            const newCam = makeCamera({
                position: camera.position,
                direction: scale(10, normalizedDir), // Maintain reasonable magnitude
                plane: scale(15, perpendicular(normalizedDir))
            });
            Object.assign(camera, newCam);
        });
    }

    /**
     * Create a camera looking at a specific point.
     */
    lookingAt(target: Vector) {
        return this.afterBuild(camera => {
            const dir = subtract(target, camera.position);
            const normalizedDir = normalize(dir);
            const newCam = makeCamera({
                position: camera.position,
                direction: scale(10, normalizedDir),
                plane: scale(15, perpendicular(normalizedDir))
            });
            Object.assign(camera, newCam);
        });
    }

    /**
     * Create a camera facing north (up, negative Y in screen coords but positive in world).
     */
    facingNorth() {
        return this.lookingToward([0, -1]);
    }

    /**
     * Create a camera facing south (down).
     */
    facingSouth() {
        return this.lookingToward([0, 1]);
    }

    /**
     * Create a camera facing east (right).
     */
    facingEast() {
        return this.lookingToward([1, 0]);
    }

    /**
     * Create a camera facing west (left).
     */
    facingWest() {
        return this.lookingToward([-1, 0]);
    }

    /**
     * Adjust field of view by scaling the plane vector.
     * Larger plane = wider FOV.
     */
    withFov(scaleFactor: number) {
        return this.afterBuild(camera => {
            const newCam = makeCamera({
                position: camera.position,
                direction: camera.direction,
                plane: scale(scaleFactor, normalize(camera.plane))
            });
            Object.assign(camera, newCam);
        });
    }
}

export const cameraFactory = CameraFactory.define<ICamera>(() => {
    const position = randomPosition();
    const direction: Vector = [0, 10]; // Default: looking "down" in world coords
    const plane: Vector = [15, 0];     // Standard FOV
    
    return makeCamera({ position, direction, plane });
});

/**
 * Convenience functions for common camera creation patterns.
 */
export const cameras = {
    /** Create a camera at position looking in direction */
    create: (position: Vector, direction: Vector, plane?: Vector) => {
        const normalizedDir = normalize(direction);
        return makeCamera({
            position,
            direction: scale(10, normalizedDir),
            plane: plane ?? scale(15, perpendicular(normalizedDir))
        });
    },
    
    /** Create a camera at position looking at target */
    lookingAt: (position: Vector, target: Vector) => {
        const dir = subtract(target, position);
        return cameras.create(position, dir);
    },
    
    /** Create a camera at the center of a region */
    centeredIn: (minX: number, minY: number, maxX: number, maxY: number, direction?: Vector) => {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        return cameras.create([centerX, centerY], direction ?? [0, 1]);
    },
    
    /** Default camera for most tests */
    default: () => makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] }),
};
