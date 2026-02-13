/**
 * Factory for creating IGeometry test data.
 */
import { Factory } from 'fishery';
import { createGeometry, IGeometry, loadGeometry, IStoredGeometry } from '../../geometry/geometry';
import { Vector } from '../../math/vector';
import { testRandom } from '../seeded-random';
import { polygons } from './polygon.factory';
import { IPolygon } from '../../geometry/polygon';
import { buildBspTree } from '../../geometry/bsp/creation';

/**
 * Generate random polygon vertices.
 */
const randomPolygonVertices = (
    minX = 0, maxX = 100,
    minY = 0, maxY = 100
): Vector[] => {
    // Generate a random triangle
    return [
        [testRandom.nextFloat(minX, maxX), testRandom.nextFloat(minY, maxY)],
        [testRandom.nextFloat(minX, maxX), testRandom.nextFloat(minY, maxY)],
        [testRandom.nextFloat(minX, maxX), testRandom.nextFloat(minY, maxY)]
    ];
};

class GeometryFactory extends Factory<IGeometry> {
    /**
     * Create geometry from specific polygon vertex arrays.
     */
    fromPolygons(polygonVertices: Vector[][]) {
        return this.afterBuild(geometry => {
            const newGeom = createGeometry(polygonVertices);
            Object.assign(geometry, newGeom);
        });
    }

    /**
     * Create geometry with a BSP tree built.
     */
    withBsp() {
        return this.afterBuild(geometry => {
            geometry.bsp = buildBspTree(geometry.polygons);
        });
    }

    /**
     * Create geometry with a single rectangle.
     */
    singleRectangle(x: number = 0, y: number = 0, width: number = 100, height: number = 100) {
        return this.fromPolygons([
            [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
        ]);
    }

    /**
     * Create geometry with multiple non-overlapping rectangles.
     */
    grid(cols: number = 2, rows: number = 2, cellSize: number = 50, gap: number = 10) {
        const polys: Vector[][] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * (cellSize + gap);
                const y = r * (cellSize + gap);
                polys.push([[x, y], [x + cellSize, y], [x + cellSize, y + cellSize], [x, y + cellSize]]);
            }
        }
        return this.fromPolygons(polys);
    }
}

export const geometryFactory = GeometryFactory.define<IGeometry>(({ sequence }) => {
    // Default: create geometry with a few random triangles
    const numPolygons = testRandom.nextInt(1, 3);
    const polyVertices: Vector[][] = [];
    
    for (let i = 0; i < numPolygons; i++) {
        polyVertices.push(randomPolygonVertices());
    }
    
    return createGeometry(polyVertices);
});

/**
 * Convenience functions for common geometry creation patterns.
 */
export const geometries = {
    /** Create geometry from polygon vertex arrays */
    from: (polygonVertices: Vector[][]) => createGeometry(polygonVertices),
    
    /** Create empty geometry */
    empty: () => createGeometry([]),
    
    /** Create geometry with a single polygon */
    single: (vertices: Vector[]) => createGeometry([vertices]),
    
    /** Create geometry with a single rectangle */
    rectangle: (x: number = 0, y: number = 0, width: number = 100, height: number = 100) =>
        createGeometry([[[x, y], [x + width, y], [x + width, y + height], [x, y + height]]]),
    
    /** Create geometry with a single square */
    square: (x: number = 0, y: number = 0, size: number = 100) =>
        geometries.rectangle(x, y, size, size),
    
    /** Create a simple room (hollow rectangle) */
    room: (x: number = 0, y: number = 0, width: number = 100, height: number = 100, wallThickness: number = 5) => {
        const outer: Vector[] = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
        const inner: Vector[] = [
            [x + wallThickness, y + wallThickness],
            [x + width - wallThickness, y + wallThickness],
            [x + width - wallThickness, y + height - wallThickness],
            [x + wallThickness, y + height - wallThickness]
        ];
        // For now just return outer walls, inner would require more complex polygon handling
        return createGeometry([outer]);
    },
    
    /** Create a grid of rectangles */
    grid: (cols: number = 2, rows: number = 2, cellSize: number = 50, gap: number = 10) => {
        const polys: Vector[][] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * (cellSize + gap);
                const y = r * (cellSize + gap);
                polys.push([[x, y], [x + cellSize, y], [x + cellSize, y + cellSize], [x, y + cellSize]]);
            }
        }
        return createGeometry(polys);
    },
    
    /** Create geometry with BSP tree */
    withBsp: (polygonVertices: Vector[][]) => {
        const geom = createGeometry(polygonVertices);
        geom.bsp = buildBspTree(geom.polygons);
        return geom;
    },
};
