/**
 * Factory for creating IEdge test data.
 */
import { Factory } from 'fishery';
import { IEdge, loadEdge, IStoredEdge } from '../../geometry/edge';
import { Vector } from '../../math/vector';
import { testRandom } from '../seeded-random';
import { materialFactory } from './material.factory';
import { IDirectedMaterial } from '../../geometry/properties';
import { createEntityKey } from '../../geometry/entity';

/**
 * Generate a random vector within bounds.
 */
const randomVector = (minX = 0, maxX = 100, minY = 0, maxY = 100): Vector => [
    testRandom.nextFloat(minX, maxX),
    testRandom.nextFloat(minY, maxY)
];

/**
 * Helper to create an edge from start/end vectors.
 */
const createEdge = (
    start: Vector, 
    end: Vector, 
    material?: IDirectedMaterial,
    immaterial: boolean = false,
    id?: string
): IEdge => {
    const stored: IStoredEdge = {
        id: id ?? createEntityKey(),
        start: { vector: start },
        end: { vector: end },
        material,
        immaterial
    };
    return loadEdge(stored);
};

class EdgeFactory extends Factory<IEdge> {
    /**
     * Create an edge between two specific points.
     */
    from(start: Vector, end: Vector) {
        return this.afterBuild(edge => {
            const newEdge = createEdge(start, end, edge.material, edge.immaterial, edge.id);
            Object.assign(edge, newEdge);
        });
    }

    /**
     * Create a horizontal edge at y position.
     */
    horizontal(y: number = 50, x1: number = 0, x2: number = 100) {
        return this.from([x1, y], [x2, y]);
    }

    /**
     * Create a vertical edge at x position.
     */
    vertical(x: number = 50, y1: number = 0, y2: number = 100) {
        return this.from([x, y1], [x, y2]);
    }

    /**
     * Create an edge with a solid, opaque material.
     */
    opaque() {
        return this.afterBuild(edge => {
            edge.material = materialFactory.build({ color: [255, 0, 0, 1] });
            edge.immaterial = false;
        });
    }

    /**
     * Create an edge with a translucent material.
     */
    translucent(alpha: number = 0.5) {
        return this.afterBuild(edge => {
            edge.material = materialFactory.build({ color: [128, 128, 128, alpha] });
            edge.immaterial = false;
        });
    }

    /**
     * Create an immaterial edge (passable but visible, like a waterfall).
     */
    immaterial() {
        return this.afterBuild(edge => {
            edge.immaterial = true;
        });
    }

    /**
     * Create an edge with no material (like BSP split edges).
     */
    withoutMaterial() {
        return this.afterBuild(edge => {
            edge.material = undefined;
        });
    }

    /**
     * Create an edge with a specific material.
     */
    withMaterial(material: IDirectedMaterial) {
        return this.afterBuild(edge => {
            edge.material = material;
        });
    }

    /**
     * Create an edge with a texture.
     */
    textured() {
        return this.afterBuild(edge => {
            edge.material = materialFactory.build({
                texture: { id: `texture-${testRandom.nextInt(1, 10)}`, index: 0 }
            });
        });
    }
}

export const edgeFactory = EdgeFactory.define<IEdge>(({ sequence }) => {
    const start = randomVector();
    const end = randomVector();
    return createEdge(start, end, materialFactory.build(), false, `edge-${sequence}`);
});

/**
 * Convenience functions for common edge creation patterns.
 */
export const edges = {
    /** Create an edge between two points */
    from: (start: Vector, end: Vector, material?: IDirectedMaterial) => 
        createEdge(start, end, material ?? materialFactory.build()),
    
    /** Create a horizontal edge */
    horizontal: (y: number = 50, x1: number = 0, x2: number = 100, material?: IDirectedMaterial) =>
        createEdge([x1, y], [x2, y], material ?? materialFactory.build()),
    
    /** Create a vertical edge */
    vertical: (x: number = 50, y1: number = 0, y2: number = 100, material?: IDirectedMaterial) =>
        createEdge([x, y1], [x, y2], material ?? materialFactory.build()),
    
    /** Create an immaterial edge (passable but visible) */
    immaterial: (start: Vector, end: Vector, material?: IDirectedMaterial) =>
        createEdge(start, end, material ?? materialFactory.build(), true),
};

/**
 * Build a list of connected edges forming a closed polygon boundary.
 */
export const buildEdgeLoop = (vertices: Vector[], material?: IDirectedMaterial): IEdge[] => {
    const result: IEdge[] = [];
    for (let i = 0; i < vertices.length; i++) {
        const start = vertices[i];
        const end = vertices[(i + 1) % vertices.length];
        result.push(edges.from(start, end, material));
    }
    return result;
};
