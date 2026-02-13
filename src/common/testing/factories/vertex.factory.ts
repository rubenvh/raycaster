/**
 * Factory for creating IVertex test data.
 */
import { Factory } from 'fishery';
import { IVertex, makeVertex } from '../../geometry/vertex';
import { Vector } from '../../math/vector';
import { testRandom } from '../seeded-random';

/**
 * Generate a random vector within bounds.
 */
const randomVector = (minX = 0, maxX = 100, minY = 0, maxY = 100): Vector => [
    testRandom.nextFloat(minX, maxX),
    testRandom.nextFloat(minY, maxY)
];

class VertexFactory extends Factory<IVertex> {
    /**
     * Create a vertex at a specific position.
     */
    at(x: number, y: number) {
        return this.params({ vector: [x, y] });
    }

    /**
     * Create a vertex at the origin.
     */
    atOrigin() {
        return this.at(0, 0);
    }

    /**
     * Create a vertex within specific bounds.
     */
    withinBounds(minX: number, maxX: number, minY: number, maxY: number) {
        return this.params({ vector: randomVector(minX, maxX, minY, maxY) });
    }
}

export const vertexFactory = VertexFactory.define<IVertex>(() => {
    return makeVertex(randomVector());
});

/**
 * Build a list of vertices forming a path.
 */
export const buildVertexPath = (points: Vector[]): IVertex[] => 
    points.map(p => vertexFactory.build({ vector: p }));
