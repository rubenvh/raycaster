/**
 * Factory for creating IPolygon test data.
 */
import { Factory } from 'fishery';
import { createPolygon, IPolygon } from '../../geometry/polygon';
import { Vector } from '../../math/vector';
import { testRandom } from '../seeded-random';
import { IDirectedMaterial } from '../../geometry/properties';
import { materialFactory } from './material.factory';
import { buildEdgeLoop } from './edge.factory';
import { loadPolygon } from '../../geometry/polygon';
import { createEntityKey } from '../../geometry/entity';

/**
 * Generate random vertices for a polygon within bounds.
 */
const randomVertices = (
    count: number,
    minX = 0, maxX = 100,
    minY = 0, maxY = 100
): Vector[] => {
    const vertices: Vector[] = [];
    for (let i = 0; i < count; i++) {
        vertices.push([
            testRandom.nextFloat(minX, maxX),
            testRandom.nextFloat(minY, maxY)
        ]);
    }
    return vertices;
};

class PolygonFactory extends Factory<IPolygon> {
    /**
     * Create a polygon from specific vertices.
     */
    fromVertices(vertices: Vector[]) {
        return this.afterBuild(poly => {
            const newPoly = createPolygon(vertices);
            Object.assign(poly, newPoly);
        });
    }

    /**
     * Create a triangle.
     */
    triangle(v1?: Vector, v2?: Vector, v3?: Vector) {
        const vertices = [
            v1 ?? [0, 0] as Vector,
            v2 ?? [100, 0] as Vector,
            v3 ?? [50, 100] as Vector
        ];
        return this.fromVertices(vertices);
    }

    /**
     * Create an axis-aligned rectangle.
     */
    rectangle(x: number = 0, y: number = 0, width: number = 100, height: number = 100) {
        return this.fromVertices([
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height]
        ]);
    }

    /**
     * Create a square.
     */
    square(x: number = 0, y: number = 0, size: number = 100) {
        return this.rectangle(x, y, size, size);
    }

    /**
     * Create a convex polygon (regular n-gon).
     */
    convex(sides: number = 5, centerX: number = 50, centerY: number = 50, radius: number = 40) {
        const vertices: Vector[] = [];
        for (let i = 0; i < sides; i++) {
            const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
            vertices.push([
                centerX + radius * Math.cos(angle),
                centerY + radius * Math.sin(angle)
            ]);
        }
        return this.fromVertices(vertices);
    }

    /**
     * Create a concave polygon (star shape).
     */
    concave(points: number = 5, centerX: number = 50, centerY: number = 50, outerRadius: number = 40, innerRadius: number = 20) {
        const vertices: Vector[] = [];
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * i) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            vertices.push([
                centerX + radius * Math.cos(angle),
                centerY + radius * Math.sin(angle)
            ]);
        }
        return this.fromVertices(vertices);
    }
}

export const polygonFactory = PolygonFactory.define<IPolygon>(({ sequence }) => {
    // Default: create a random triangle
    const vertices = randomVertices(3);
    return createPolygon(vertices);
});

/**
 * Convenience functions for common polygon creation patterns.
 */
export const polygons = {
    /** Create a polygon from vertices */
    from: (vertices: Vector[]) => createPolygon(vertices),
    
    /** Create a triangle */
    triangle: (v1: Vector = [0, 0], v2: Vector = [100, 0], v3: Vector = [50, 100]) =>
        createPolygon([v1, v2, v3]),
    
    /** Create a rectangle */
    rectangle: (x: number = 0, y: number = 0, width: number = 100, height: number = 100) =>
        createPolygon([[x, y], [x + width, y], [x + width, y + height], [x, y + height]]),
    
    /** Create a square */
    square: (x: number = 0, y: number = 0, size: number = 100) =>
        polygons.rectangle(x, y, size, size),
    
    /** Create a convex regular polygon */
    convex: (sides: number = 5, centerX: number = 50, centerY: number = 50, radius: number = 40) => {
        const vertices: Vector[] = [];
        for (let i = 0; i < sides; i++) {
            const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
            vertices.push([
                centerX + radius * Math.cos(angle),
                centerY + radius * Math.sin(angle)
            ]);
        }
        return createPolygon(vertices);
    },
    
    /** Create a concave star polygon */
    star: (points: number = 5, centerX: number = 50, centerY: number = 50, outerRadius: number = 40, innerRadius: number = 20) => {
        const vertices: Vector[] = [];
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * i) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            vertices.push([
                centerX + radius * Math.cos(angle),
                centerY + radius * Math.sin(angle)
            ]);
        }
        return createPolygon(vertices);
    },

    /**
     * Create a polygon with custom edges (for testing materials).
     */
    withMaterial: (vertices: Vector[], material: IDirectedMaterial) => {
        const edges = buildEdgeLoop(vertices, material);
        return loadPolygon({ id: createEntityKey(), edges: edges.map(e => ({
            id: e.id,
            start: e.start,
            end: e.end,
            material: e.material,
            immaterial: e.immaterial
        }))});
    }
};
