/**
 * Tests for all test data factories.
 * 
 * These tests exercise every factory method and convenience function
 * to ensure correctness and to achieve branch coverage.
 * 
 * Note: Fishery's Factory.define() returns Factory<T>, not the subclass type.
 * We cast to `any` to call custom methods since they exist at runtime.
 */
import { resetTestRandom, testRandom } from '../seeded-random';
import { vertexFactory, buildVertexPath } from './vertex.factory';
import { materialFactory, directedMaterialFactory, COLORS } from './material.factory';
import { edgeFactory, edges, buildEdgeLoop } from './edge.factory';
import { polygonFactory, polygons } from './polygon.factory';
import { cameraFactory, cameras } from './camera.factory';
import { geometryFactory, geometries } from './geometry.factory';
import { Vector } from '../../math/vector';

beforeEach(() => {
    resetTestRandom();
});

// Cast factories to `any` to access custom subclass methods
// (Fishery's define() returns Factory<T>, losing subclass type info)
const vf = vertexFactory as any;
const mf = materialFactory as any;
const dmf = directedMaterialFactory as any;
const ef = edgeFactory as any;
const pf = polygonFactory as any;
const cf = cameraFactory as any;
const gf = geometryFactory as any;

describe('vertexFactory', () => {
    it('builds a vertex with random position', () => {
        const v = vertexFactory.build();
        expect(v.vector).toBeDefined();
        expect(v.vector.length).toBe(2);
    });

    it('at() creates a vertex at specific position', () => {
        const v = vf.at(10, 20).build();
        expect(v.vector[0]).toBe(10);
        expect(v.vector[1]).toBe(20);
    });

    it('atOrigin() creates a vertex at (0,0)', () => {
        const v = vf.atOrigin().build();
        expect(v.vector[0]).toBe(0);
        expect(v.vector[1]).toBe(0);
    });

    it('withinBounds() creates a vertex within specified range', () => {
        const v = vf.withinBounds(10, 20, 30, 40).build();
        expect(v.vector[0]).toBeGreaterThanOrEqual(10);
        expect(v.vector[0]).toBeLessThanOrEqual(20);
        expect(v.vector[1]).toBeGreaterThanOrEqual(30);
        expect(v.vector[1]).toBeLessThanOrEqual(40);
    });

    it('buildVertexPath creates vertices from points', () => {
        const points: Vector[] = [[0, 0], [10, 10], [20, 0]];
        const path = buildVertexPath(points);
        expect(path).toHaveLength(3);
        expect(path[0].vector).toEqual([0, 0]);
        expect(path[1].vector).toEqual([10, 10]);
        expect(path[2].vector).toEqual([20, 0]);
    });

    it('buildList creates multiple vertices', () => {
        const vs = vertexFactory.buildList(5);
        expect(vs).toHaveLength(5);
        vs.forEach(v => {
            expect(v.vector).toBeDefined();
        });
    });
});

describe('materialFactory', () => {
    it('builds a material with random color', () => {
        const m = materialFactory.build();
        expect(m.color).toBeDefined();
        expect(m.color.length).toBe(4);
    });

    it('opaque() creates a fully opaque material', () => {
        const m = mf.opaque().build();
        expect(m.color[3]).toBe(1);
    });

    it('translucent() creates a translucent material with default alpha', () => {
        const m = mf.translucent().build();
        expect(m.color[3]).toBe(0.5);
    });

    it('translucent(alpha) creates a translucent material with specified alpha', () => {
        const m = mf.translucent(0.3).build();
        expect(m.color[3]).toBe(0.3);
    });

    it('invisible() creates a material with alpha 0', () => {
        const m = mf.invisible().build();
        expect(m.color[3]).toBe(0);
    });

    it('withColor() creates a material with specific color', () => {
        const m = mf.withColor(COLORS.red).build();
        expect(m.color).toEqual(COLORS.red);
    });

    it('textured() creates a material with auto-generated texture', () => {
        const m = mf.textured().build();
        expect(m.texture).toBeDefined();
        expect(m.texture.id).toMatch(/^texture-/);
        expect(m.texture.index).toBe(0);
    });

    it('textured(ref) creates a material with specific texture reference', () => {
        const ref = { id: 'custom-tex', index: 3 };
        const m = mf.textured(ref).build();
        expect(m.texture).toEqual(ref);
    });

    it('red() creates a red material', () => {
        const m = mf.red().build();
        expect(m.color[0]).toBe(255);
        expect(m.color[1]).toBe(0);
        expect(m.color[2]).toBe(0);
        expect(m.color[3]).toBe(1);
    });

    it('red(alpha) creates a red material with specified alpha', () => {
        const m = mf.red(0.7).build();
        expect(m.color[0]).toBe(255);
        expect(m.color[3]).toBe(0.7);
    });

    it('blue() creates a blue material', () => {
        const m = mf.blue().build();
        expect(m.color[0]).toBe(0);
        expect(m.color[1]).toBe(0);
        expect(m.color[2]).toBe(255);
        expect(m.color[3]).toBe(1);
    });

    it('blue(alpha) creates a blue material with specified alpha', () => {
        const m = mf.blue(0.4).build();
        expect(m.color[2]).toBe(255);
        expect(m.color[3]).toBe(0.4);
    });

    it('COLORS contains expected presets', () => {
        expect(COLORS.red).toEqual([255, 0, 0, 1]);
        expect(COLORS.green).toEqual([0, 255, 0, 1]);
        expect(COLORS.blue).toEqual([0, 0, 255, 1]);
        expect(COLORS.white).toEqual([255, 255, 255, 1]);
        expect(COLORS.black).toEqual([0, 0, 0, 1]);
        expect(COLORS.transparent).toEqual([0, 0, 0, 0]);
        expect(COLORS.semiTransparent).toEqual([128, 128, 128, 0.5]);
    });
});

describe('directedMaterialFactory', () => {
    it('builds a directed material (default is single-sided)', () => {
        const dm = directedMaterialFactory.build();
        expect(dm).toBeDefined();
    });

    it('singleSided() creates a single-sided material', () => {
        const dm = dmf.singleSided().build();
        expect(dm).toBeDefined();
        expect(dm.color).toBeDefined();
    });

    it('doubleSided() creates a double-sided material with auto-generated front/back', () => {
        const dm = dmf.doubleSided().build();
        expect(dm).toBeDefined();
    });

    it('doubleSided(front, back) creates material with specified front and back', () => {
        const front = mf.red().build();
        const back = mf.blue().build();
        const dm = dmf.doubleSided(front, back).build();
        expect(dm).toBeDefined();
    });
});

describe('edgeFactory', () => {
    it('builds an edge with random start/end', () => {
        const e = edgeFactory.build();
        expect(e.start).toBeDefined();
        expect(e.end).toBeDefined();
        expect(e.segment).toBeDefined();
        expect(e.material).toBeDefined();
    });

    it('from() creates an edge between specific points', () => {
        const e = ef.from([0, 0], [100, 0]).build();
        expect(e.start.vector).toEqual([0, 0]);
        expect(e.end.vector).toEqual([100, 0]);
    });

    it('horizontal() creates a horizontal edge with defaults', () => {
        const e = ef.horizontal().build();
        expect(e.start.vector[1]).toBe(50);
        expect(e.end.vector[1]).toBe(50);
        expect(e.start.vector[0]).toBe(0);
        expect(e.end.vector[0]).toBe(100);
    });

    it('horizontal(y, x1, x2) creates a horizontal edge at specified position', () => {
        const e = ef.horizontal(25, 10, 90).build();
        expect(e.start.vector).toEqual([10, 25]);
        expect(e.end.vector).toEqual([90, 25]);
    });

    it('vertical() creates a vertical edge with defaults', () => {
        const e = ef.vertical().build();
        expect(e.start.vector[0]).toBe(50);
        expect(e.end.vector[0]).toBe(50);
        expect(e.start.vector[1]).toBe(0);
        expect(e.end.vector[1]).toBe(100);
    });

    it('vertical(x, y1, y2) creates a vertical edge at specified position', () => {
        const e = ef.vertical(30, 5, 95).build();
        expect(e.start.vector).toEqual([30, 5]);
        expect(e.end.vector).toEqual([30, 95]);
    });

    it('opaque() creates an edge with opaque material', () => {
        const e = ef.opaque().build();
        expect(e.material).toBeDefined();
        expect(e.material.color[3]).toBe(1);
        expect(e.immaterial).toBe(false);
    });

    it('translucent() creates an edge with translucent material (default alpha)', () => {
        const e = ef.translucent().build();
        expect(e.material).toBeDefined();
        expect(e.material.color[3]).toBe(0.5);
        expect(e.immaterial).toBe(false);
    });

    it('translucent(alpha) creates an edge with specified alpha', () => {
        const e = ef.translucent(0.3).build();
        expect(e.material.color[3]).toBe(0.3);
    });

    it('immaterial() creates an immaterial edge', () => {
        const e = ef.immaterial().build();
        expect(e.immaterial).toBe(true);
    });

    it('withoutMaterial() creates an edge with no material', () => {
        const e = ef.withoutMaterial().build();
        expect(e.material).toBeUndefined();
    });

    it('withMaterial() sets a specific material', () => {
        const mat = mf.red().build();
        const e = ef.withMaterial(mat).build();
        expect(e.material).toBe(mat);
    });

    it('textured() creates an edge with a textured material', () => {
        const e = ef.textured().build();
        expect(e.material).toBeDefined();
        expect(e.material.texture).toBeDefined();
        expect(e.material.texture.id).toMatch(/^texture-/);
    });

    it('chaining: from().opaque() works', () => {
        const e = ef.from([0, 0], [50, 50]).opaque().build();
        expect(e.start.vector).toEqual([0, 0]);
        expect(e.end.vector).toEqual([50, 50]);
        expect(e.material.color[3]).toBe(1);
    });

    it('buildList creates multiple edges', () => {
        const es = edgeFactory.buildList(3);
        expect(es).toHaveLength(3);
    });
});

describe('edges convenience functions', () => {
    it('edges.from() creates an edge between two points', () => {
        const e = edges.from([0, 0], [10, 10]);
        expect(e.start.vector).toEqual([0, 0]);
        expect(e.end.vector).toEqual([10, 10]);
        expect(e.material).toBeDefined();
    });

    it('edges.from() with material', () => {
        const mat = mf.red().build();
        const e = edges.from([0, 0], [10, 10], mat);
        expect(e.material).toBe(mat);
    });

    it('edges.horizontal() with defaults', () => {
        const e = edges.horizontal();
        expect(e.start.vector).toEqual([0, 50]);
        expect(e.end.vector).toEqual([100, 50]);
    });

    it('edges.horizontal() with custom values', () => {
        const mat = mf.blue().build();
        const e = edges.horizontal(30, 5, 95, mat);
        expect(e.start.vector).toEqual([5, 30]);
        expect(e.end.vector).toEqual([95, 30]);
        expect(e.material).toBe(mat);
    });

    it('edges.vertical() with defaults', () => {
        const e = edges.vertical();
        expect(e.start.vector).toEqual([50, 0]);
        expect(e.end.vector).toEqual([50, 100]);
    });

    it('edges.vertical() with custom values', () => {
        const mat = materialFactory.build();
        const e = edges.vertical(25, 10, 90, mat);
        expect(e.start.vector).toEqual([25, 10]);
        expect(e.end.vector).toEqual([25, 90]);
        expect(e.material).toBe(mat);
    });

    it('edges.immaterial() creates an immaterial edge', () => {
        const e = edges.immaterial([0, 0], [10, 10]);
        expect(e.immaterial).toBe(true);
        expect(e.material).toBeDefined();
    });

    it('edges.immaterial() with specific material', () => {
        const mat = materialFactory.build();
        const e = edges.immaterial([0, 0], [10, 10], mat);
        expect(e.immaterial).toBe(true);
        expect(e.material).toBe(mat);
    });

    it('buildEdgeLoop() creates a closed loop of edges', () => {
        const verts: Vector[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
        const loop = buildEdgeLoop(verts);
        expect(loop).toHaveLength(4);
        expect(loop[0].start.vector).toEqual([0, 0]);
        expect(loop[0].end.vector).toEqual([100, 0]);
        expect(loop[3].start.vector).toEqual([0, 100]);
        expect(loop[3].end.vector).toEqual([0, 0]);
    });

    it('buildEdgeLoop() with material', () => {
        const mat = mf.red().build();
        const verts: Vector[] = [[0, 0], [10, 0], [10, 10]];
        const loop = buildEdgeLoop(verts, mat);
        expect(loop).toHaveLength(3);
        loop.forEach(e => expect(e.material).toBe(mat));
    });
});

describe('polygonFactory', () => {
    it('builds a polygon with random vertices', () => {
        const p = polygonFactory.build();
        expect(p.vertices).toBeDefined();
        expect(p.vertices.length).toBeGreaterThanOrEqual(3);
        expect(p.edges).toBeDefined();
        expect(p.boundingBox).toBeDefined();
    });

    it('fromVertices() creates polygon from specific vertices', () => {
        const verts: Vector[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
        const p = pf.fromVertices(verts).build();
        expect(p.vertices).toHaveLength(4);
    });

    it('triangle() with defaults', () => {
        const p = pf.triangle().build();
        expect(p.vertices).toHaveLength(3);
    });

    it('triangle() with custom vertices', () => {
        const p = pf.triangle([0, 0], [50, 0], [25, 50]).build();
        expect(p.vertices).toHaveLength(3);
    });

    it('rectangle() with defaults', () => {
        const p = pf.rectangle().build();
        expect(p.vertices).toHaveLength(4);
    });

    it('rectangle() with custom dimensions', () => {
        const p = pf.rectangle(10, 20, 50, 60).build();
        expect(p.vertices).toHaveLength(4);
    });

    it('square() with defaults', () => {
        const p = pf.square().build();
        expect(p.vertices).toHaveLength(4);
    });

    it('square() with custom position and size', () => {
        const p = pf.square(5, 10, 50).build();
        expect(p.vertices).toHaveLength(4);
    });

    it('convex() with defaults creates a regular pentagon', () => {
        const p = pf.convex().build();
        expect(p.vertices).toHaveLength(5);
    });

    it('convex() with custom params', () => {
        const p = pf.convex(6, 100, 100, 50).build();
        expect(p.vertices).toHaveLength(6);
    });

    it('concave() with defaults creates a star', () => {
        const p = pf.concave().build();
        expect(p.vertices).toHaveLength(10);
    });

    it('concave() with custom params', () => {
        const p = pf.concave(4, 50, 50, 30, 15).build();
        expect(p.vertices).toHaveLength(8);
    });

    it('buildList creates multiple polygons', () => {
        const ps = polygonFactory.buildList(3);
        expect(ps).toHaveLength(3);
    });
});

describe('polygons convenience functions', () => {
    it('polygons.from() creates polygon from vertices', () => {
        const p = polygons.from([[0, 0], [10, 0], [10, 10]]);
        expect(p.vertices).toHaveLength(3);
    });

    it('polygons.triangle() with defaults', () => {
        const p = polygons.triangle();
        expect(p.vertices).toHaveLength(3);
    });

    it('polygons.triangle() with custom vertices', () => {
        const p = polygons.triangle([0, 0], [50, 0], [25, 50]);
        expect(p.vertices).toHaveLength(3);
    });

    it('polygons.rectangle() with defaults', () => {
        const p = polygons.rectangle();
        expect(p.vertices).toHaveLength(4);
    });

    it('polygons.rectangle() with custom dimensions', () => {
        const p = polygons.rectangle(5, 10, 200, 300);
        expect(p.vertices).toHaveLength(4);
    });

    it('polygons.square() with defaults', () => {
        const p = polygons.square();
        expect(p.vertices).toHaveLength(4);
    });

    it('polygons.square() with custom values', () => {
        const p = polygons.square(10, 20, 50);
        expect(p.vertices).toHaveLength(4);
    });

    it('polygons.convex() with defaults', () => {
        const p = polygons.convex();
        expect(p.vertices).toHaveLength(5);
    });

    it('polygons.convex() with custom params', () => {
        const p = polygons.convex(8, 50, 50, 30);
        expect(p.vertices).toHaveLength(8);
    });

    it('polygons.star() with defaults', () => {
        const p = polygons.star();
        expect(p.vertices).toHaveLength(10);
    });

    it('polygons.star() with custom params', () => {
        const p = polygons.star(3, 50, 50, 40, 20);
        expect(p.vertices).toHaveLength(6);
    });

    it('polygons.withMaterial() creates a polygon with custom material', () => {
        const mat = mf.red().build();
        const p = polygons.withMaterial([[0, 0], [10, 0], [10, 10]], mat);
        expect(p.vertices).toHaveLength(3);
        expect(p.edges).toHaveLength(3);
        p.edges.forEach(e => {
            expect(e.material).toBe(mat);
        });
    });
});

describe('cameraFactory', () => {
    it('builds a camera with random position', () => {
        const cam = cameraFactory.build();
        expect(cam.position).toBeDefined();
        expect(cam.direction).toBeDefined();
        expect(cam.plane).toBeDefined();
        expect(cam.screen).toBeDefined();
        expect(cam.cone).toBeDefined();
    });

    it('at() creates a camera at specific position', () => {
        const cam = cf.at(50, 50).build();
        expect(cam.position[0]).toBe(50);
        expect(cam.position[1]).toBe(50);
    });

    it('lookingToward() creates a camera looking in a direction', () => {
        const cam = cf.lookingToward([1, 0]).build();
        expect(cam.direction[0]).toBeGreaterThan(0);
    });

    it('lookingAt() creates a camera looking at a target', () => {
        const cam = cf.at(0, 0).lookingAt([100, 0]).build();
        expect(cam.direction[0]).toBeGreaterThan(0);
    });

    it('facingNorth() creates a camera facing up', () => {
        const cam = cf.facingNorth().build();
        expect(cam.direction[1]).toBeLessThan(0);
    });

    it('facingSouth() creates a camera facing down', () => {
        const cam = cf.facingSouth().build();
        expect(cam.direction[1]).toBeGreaterThan(0);
    });

    it('facingEast() creates a camera facing right', () => {
        const cam = cf.facingEast().build();
        expect(cam.direction[0]).toBeGreaterThan(0);
    });

    it('facingWest() creates a camera facing left', () => {
        const cam = cf.facingWest().build();
        expect(cam.direction[0]).toBeLessThan(0);
    });

    it('withFov() adjusts field of view', () => {
        const narrow = cf.withFov(5).build();
        const wide = cf.withFov(20).build();
        const narrowMag = Math.sqrt(narrow.plane[0] ** 2 + narrow.plane[1] ** 2);
        const wideMag = Math.sqrt(wide.plane[0] ** 2 + wide.plane[1] ** 2);
        expect(wideMag).toBeGreaterThan(narrowMag);
    });

    it('chaining: at().facingEast() works', () => {
        const cam = cf.at(25, 75).facingEast().build();
        expect(cam.position[0]).toBe(25);
        expect(cam.position[1]).toBe(75);
        expect(cam.direction[0]).toBeGreaterThan(0);
    });

    it('buildList creates multiple cameras', () => {
        const cams = cameraFactory.buildList(3);
        expect(cams).toHaveLength(3);
    });
});

describe('cameras convenience functions', () => {
    it('cameras.create() with position and direction', () => {
        const cam = cameras.create([50, 50], [1, 0]);
        expect(cam.position).toEqual([50, 50]);
        expect(cam.direction[0]).toBeGreaterThan(0);
    });

    it('cameras.create() with custom plane', () => {
        const cam = cameras.create([50, 50], [1, 0], [0, 10]);
        expect(cam.plane).toEqual([0, 10]);
    });

    it('cameras.lookingAt() creates a camera pointing at target', () => {
        const cam = cameras.lookingAt([0, 0], [100, 0]);
        expect(cam.position).toEqual([0, 0]);
        expect(cam.direction[0]).toBeGreaterThan(0);
    });

    it('cameras.centeredIn() creates a camera centered in a region', () => {
        const cam = cameras.centeredIn(0, 0, 100, 100);
        expect(cam.position[0]).toBe(50);
        expect(cam.position[1]).toBe(50);
    });

    it('cameras.centeredIn() with custom direction', () => {
        const cam = cameras.centeredIn(0, 0, 100, 100, [1, 0]);
        expect(cam.position[0]).toBe(50);
        expect(cam.position[1]).toBe(50);
        expect(cam.direction[0]).toBeGreaterThan(0);
    });

    it('cameras.default() creates a standard camera', () => {
        const cam = cameras.default();
        expect(cam.position).toEqual([50, 50]);
        expect(cam.direction).toEqual([0, 10]);
        expect(cam.plane).toEqual([15, 0]);
    });
});

describe('geometryFactory', () => {
    it('builds geometry with random polygons', () => {
        const g = geometryFactory.build();
        expect(g.polygons).toBeDefined();
        expect(g.polygons.length).toBeGreaterThanOrEqual(1);
    });

    it('fromPolygons() creates geometry from specific polygon vertices', () => {
        const g = gf.fromPolygons([
            [[0, 0], [10, 0], [10, 10]],
            [[20, 20], [30, 20], [30, 30]]
        ]).build();
        expect(g.polygons).toHaveLength(2);
    });

    it('withBsp() builds a BSP tree', () => {
        const g = gf.fromPolygons([
            [[0, 0], [10, 0], [10, 10], [0, 10]],
            [[20, 20], [30, 20], [30, 30], [20, 30]]
        ]).withBsp().build();
        expect(g.bsp).toBeDefined();
    });

    it('singleRectangle() with defaults', () => {
        const g = gf.singleRectangle().build();
        expect(g.polygons).toHaveLength(1);
        expect(g.polygons[0].vertices).toHaveLength(4);
    });

    it('singleRectangle() with custom dimensions', () => {
        const g = gf.singleRectangle(10, 20, 50, 60).build();
        expect(g.polygons).toHaveLength(1);
    });

    it('grid() with defaults creates 2x2 grid', () => {
        const g = gf.grid().build();
        expect(g.polygons).toHaveLength(4);
    });

    it('grid() with custom dimensions', () => {
        const g = gf.grid(3, 2, 40, 5).build();
        expect(g.polygons).toHaveLength(6);
    });

    it('buildList creates multiple geometries', () => {
        const gs = geometryFactory.buildList(2);
        expect(gs).toHaveLength(2);
    });
});

describe('geometries convenience functions', () => {
    it('geometries.from() creates geometry from polygon vertices', () => {
        const g = geometries.from([[[0, 0], [10, 0], [10, 10]]]);
        expect(g.polygons).toHaveLength(1);
    });

    it('geometries.empty() creates empty geometry', () => {
        const g = geometries.empty();
        expect(g.polygons).toHaveLength(0);
    });

    it('geometries.single() creates geometry with one polygon', () => {
        const g = geometries.single([[0, 0], [10, 0], [10, 10]]);
        expect(g.polygons).toHaveLength(1);
    });

    it('geometries.rectangle() with defaults', () => {
        const g = geometries.rectangle();
        expect(g.polygons).toHaveLength(1);
        expect(g.polygons[0].vertices).toHaveLength(4);
    });

    it('geometries.rectangle() with custom dimensions', () => {
        const g = geometries.rectangle(5, 10, 200, 300);
        expect(g.polygons).toHaveLength(1);
    });

    it('geometries.square() with defaults', () => {
        const g = geometries.square();
        expect(g.polygons).toHaveLength(1);
    });

    it('geometries.square() with custom values', () => {
        const g = geometries.square(10, 20, 50);
        expect(g.polygons).toHaveLength(1);
    });

    it('geometries.room() with defaults', () => {
        const g = geometries.room();
        expect(g.polygons).toHaveLength(1);
    });

    it('geometries.room() with custom dimensions', () => {
        const g = geometries.room(0, 0, 200, 200, 10);
        expect(g.polygons).toHaveLength(1);
    });

    it('geometries.grid() with defaults', () => {
        const g = geometries.grid();
        expect(g.polygons).toHaveLength(4);
    });

    it('geometries.grid() with custom dimensions', () => {
        const g = geometries.grid(3, 3, 30, 5);
        expect(g.polygons).toHaveLength(9);
    });

    it('geometries.withBsp() creates geometry with BSP tree', () => {
        const g = geometries.withBsp([
            [[0, 0], [10, 0], [10, 10], [0, 10]],
            [[20, 20], [30, 20], [30, 30], [20, 30]]
        ]);
        expect(g.bsp).toBeDefined();
        expect(g.polygons).toHaveLength(2);
    });
});

describe('SeededRandom - uncovered methods', () => {
    it('nextBool() returns boolean with default probability', () => {
        const results = new Set<boolean>();
        for (let i = 0; i < 20; i++) {
            results.add(testRandom.nextBool());
        }
        expect(results.has(true)).toBe(true);
        expect(results.has(false)).toBe(true);
    });

    it('nextBool(1) always returns true', () => {
        for (let i = 0; i < 10; i++) {
            expect(testRandom.nextBool(1)).toBe(true);
        }
    });

    it('nextBool(0) always returns false', () => {
        for (let i = 0; i < 10; i++) {
            expect(testRandom.nextBool(0)).toBe(false);
        }
    });

    it('pick() selects a random element from an array', () => {
        const items = ['a', 'b', 'c', 'd', 'e'];
        const picked = testRandom.pick(items);
        expect(items).toContain(picked);
    });

    it('pick() returns different elements over many calls', () => {
        const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const results = new Set<number>();
        for (let i = 0; i < 20; i++) {
            results.add(testRandom.pick(items));
        }
        expect(results.size).toBeGreaterThan(1);
    });

    it('shuffle() shuffles an array in place', () => {
        const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const arr = [...original];
        const result = testRandom.shuffle(arr);
        expect(result).toBe(arr);
        expect(result.sort((a, b) => a - b)).toEqual(original);
    });

    it('shuffle() with single element array', () => {
        const arr = [42];
        const result = testRandom.shuffle(arr);
        expect(result).toEqual([42]);
    });

    it('shuffle() with empty array', () => {
        const arr: number[] = [];
        const result = testRandom.shuffle(arr);
        expect(result).toEqual([]);
    });
});
