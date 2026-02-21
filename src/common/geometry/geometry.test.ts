import { 
    createGeometry, 
    splitPolygon, 
    IStoredGeometry, 
    loadGeometry, 
    removeVertex, 
    IGeometry,
    splitEdge,
    moveVertices,
    transformEdges,
    expandPolygon,
    rotatePolygon,
    reversePolygon,
    duplicatePolygons,
    selectRegion,
    queryVertex,
    queryEdge,
    queryPolygon,
    storeGeometry,
    addPolygon,
    detectCollisionAt,
    EMPTY_GEOMETRY,
    subdivideEdge,
    extrudeEdge,
    bevelVertex,
    insetEdge,
    flipPolygon,
    scalePolygon,
    regularizePolygon,
    convexHull,
    insetPolygon,
    mergePolygons,
    alignVertices,
    alignPolygons,
    weldVertices,
    createRegularPolygon,
} from './geometry';
import { Vector } from '../math/vector';
import { IVertexMap } from './vertex';
import { polygons, materialFactory, resetTestRandom } from '../testing/factories';
import { BoundingBox, centerOf } from './polygon';
import { isVertex, isEdge, isPolygon } from '../selection/selectable';

describe('geometry tests', () => {
    beforeEach(() => resetTestRandom());
    describe('creating geometry from vectors', () => {
        const invokeSut = (vectors: Vector[][]) => createGeometry(vectors);

        describe('creating a single polygon', () => {
            it('then results in single polygon', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0]]]);
                expect(actual.polygons.length).toBe(1);                
            });
            it('then polygon is closed automatically', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0]]]);
                expect(actual.polygons[0].vertices.length).toBe(3);
                expect(actual.polygons[0].edges.length).toBe(3);
            });
            it('then last vertex merged into first vertex if identical', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0], [0, 0]]]).polygons[0];
                expect(actual.vertices.length).toBe(3);
                expect(actual.edges.length).toBe(3);
                expect(actual.edges[actual.edges.length-1].end).toBe(actual.edges[0].start);

            });
            it('then last vertex merged into first vertex if same', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0], [0.001, 0.001]]]);
                expect(actual.polygons[0].vertices.length).toBe(3);
                expect(actual.polygons[0].edges.length).toBe(3);
            });                  
        });
    });
    describe('loading geometry from objects', () => {
        const invokeSut = (geometryData: IStoredGeometry) => loadGeometry(geometryData);

        describe('creating a single polygon', () => {
            it('then results in single polygon', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0, 0]}},
                ]}]});

                expect(actual.polygons.length).toBe(1);
            });           
            it('then last vertex merged into first vertex if identical', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0, 0]}},
                ]}]}).polygons[0];   
                expect(actual.vertices.length).toBe(3);
                expect(actual.edges.length).toBe(3);
                expect(actual.edges[actual.edges.length-1].end === actual.edges[0].start).toBeTruthy();
            });            
            it('then last vertex merged into first vertex if same', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0.001, 0.001]}},
                ]}]});  
                expect(actual.polygons[0].vertices.length).toBe(3);
                expect(actual.polygons[0].edges.length).toBe(3);
            });   
            it('then start of next is same as end of previous', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0, 0]}},
                ]}]});  

                let p = actual.polygons[0];
                p.edges.reduce((acc, p) => {
                    expect(p.start).toBe(acc.end);
                    return p;
                });                
            }); 
        });
    });
    describe('removing geometry', () => {
        // create 2 polygons
        const geometry: IGeometry = createGeometry([
            [[0, 0],[0,1], [1,1],[1,0]],
            [[5, 5],[5,6], [6,6],[6,5]]
        ]);

        describe('removing entire polygon', () => {
            it('then polygon is not present anymore', () => {
                const polygon = geometry.polygons[0];
                const actual = polygon.vertices.reduce((acc, cur) => removeVertex(cur, polygon.id, acc), geometry);                
                expect(actual.polygons.find(_ => _.id === polygon.id)).toBeUndefined();                
            });                      
        });
        describe('removing vertex', () => {
            it('then polygon still exists without deleted vertex', () => {
                const polygon = geometry.polygons[0];
                const vertexToDelete = polygon.vertices[0];
                const actual = removeVertex(vertexToDelete, polygon.id, geometry);                
                expect(actual.polygons.some(_ => _.id === polygon.id)).toBeTruthy();
                const changedPoly = actual.polygons.find(_=>_.id === polygon.id);
                expect(changedPoly.vertices.length).toBe(3);
                expect(changedPoly.vertices.find(_=>_.id === vertexToDelete.id)).toBeUndefined();
                
            });                      
        });
    });

    describe('splitting polygon', () => {
        // create 1 polygons
        const geometry: IGeometry = createGeometry([[[0, 0],[0,1], [1,1],[1,0]]]);

        describe('split polygon using 2 opposing vertices', () => {
            it('then 2 polygons present with different ids', () => {
                const polygon = geometry.polygons[0];
                polygon.vertices[0]
                const actual = splitPolygon(polygon.vertices[0], polygon.vertices[1], polygon.id, geometry);
                expect(actual.polygons.length).toBe(2);
                expect(actual.polygons[0].id).not.toBe(actual.polygons[1].id);
            });                      
        });       
    });
    describe('perf test', () => {
        // it('running intersections for all rays', () => {
        //     const world = {
        //         camera: makeCamera({position: [50,50], direction: [0,-10], plane: [-15, 0]}),
        //         geometry: createGeometry([
        //              [[30,20],[60,20],[60,80],[100,80],[100,60],[120,60],[125,75],[140,80],[140,60],[160,60],[160,80],[180,80],[180,40],[160,40],[160,0],[260,0],[260,40],[200,40],[200,140],[240,140],[240,380],[120,380],[120,140],[180,140],[180,100],[20,100]]
        //         ]),
        //     };
        //     const start = process.hrtime();
        //     for (let i = 0; i < 600; i++) {
        //         const rays = makeRays(1280, world.camera);

        //         for (let ray of rays){
        //             var hits = detectCollisions(ray, world.geometry).hits.sort((a,b)=> a.distance - b.distance);
        //         }
        //     }      
        //     const end = process.hrtime(start);
        //     console.log(end);
        // })
    });

    describe('splitEdge', () => {
        it('splits an edge at the given point', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // Edge from [0,0] to [100,0]
            
            const result = splitEdge([50, 0], edge, polygon.id, geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id);
            expect(updatedPolygon).toBeDefined();
            expect(updatedPolygon!.edges.length).toBe(5);
        });

        it('creates new vertex at split point', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];
            
            const result = splitEdge([50, 0], edge, polygon.id, geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            const hasVertexAtSplit = updatedPolygon.vertices.some(v => 
                Math.abs(v.vector[0] - 50) < 0.001 && Math.abs(v.vector[1]) < 0.001
            );
            expect(hasVertexAtSplit).toBe(true);
        });

        it('preserves edge material', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];
            const material = materialFactory.build();
            edge.material = material;
            
            const result = splitEdge([50, 0], edge, polygon.id, geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            // Both resulting edges should have material
            const edgesWithMaterial = updatedPolygon.edges.filter(e => e.material != null);
            expect(edgesWithMaterial.length).toBeGreaterThanOrEqual(2);
        });

        it('BSP is no longer on geometry (managed by bspState)', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            
            const result = splitEdge([50, 0], polygon.edges[0], polygon.id, geometry);
            
            // BSP is no longer a property of geometry
            expect((result as any).bsp).toBeUndefined();
        });
    });

    describe('moveVertices', () => {
        it('moves vertices by delta', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const verticesToMove = [polygon.vertices[0]]; // Vertex at [0,0]
            
            const vertexMap: IVertexMap = new Map([[polygon.id, verticesToMove]]);
            const result = moveVertices(false, [10, 20], vertexMap, geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            const movedVertex = updatedPolygon.vertices.find(v => 
                Math.abs(v.vector[0] - 10) < 0.1 && Math.abs(v.vector[1] - 20) < 0.1
            );
            expect(movedVertex).toBeDefined();
        });

        it('applies snapping when enabled', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const verticesToMove = [polygon.vertices[0]];
            
            const vertexMap: IVertexMap = new Map([[polygon.id, verticesToMove]]);
            const result = moveVertices(true, [7.3, 12.8], vertexMap, geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            // Snapping should round to nearest integer
            const snappedVertex = updatedPolygon.vertices.find(v => 
                v.vector[0] % 1 === 0 && v.vector[1] % 1 === 0
            );
            expect(snappedVertex).toBeDefined();
        });

        it('moves multiple vertices', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const verticesToMove = [polygon.vertices[0], polygon.vertices[1]];
            
            const vertexMap: IVertexMap = new Map([[polygon.id, verticesToMove]]);
            const result = moveVertices(false, [10, 10], vertexMap, geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            // Check that 2 vertices moved
            const verticesNear10_10 = updatedPolygon.vertices.filter(v => 
                v.vector[0] >= 10 && v.vector[1] >= 10
            );
            expect(verticesNear10_10.length).toBe(3); // Original 2 + one already there
        });
    });

    describe('transformEdges', () => {
        it('transforms specified edges using transformer function', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edgeToTransform = polygon.edges[0];
            
            const result = transformEdges([edgeToTransform], polygon.id, 
                (e) => ({ ...e, immaterial: true }), geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            const transformedEdge = updatedPolygon.edges.find(e => e.immaterial === true);
            expect(transformedEdge).toBeDefined();
        });

        it('preserves non-transformed edges', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edgeToTransform = polygon.edges[0];
            
            const result = transformEdges([edgeToTransform], polygon.id,
                (e) => ({ ...e, immaterial: true }), geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            const unchangedEdges = updatedPolygon.edges.filter(e => !e.immaterial);
            expect(unchangedEdges.length).toBe(3);
        });
    });

    describe('expandPolygon', () => {
        it('expands polygon outward with edges staying parallel', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // top edge: (0,0) -> (100,0)
            
            // Target is above the edge (outward for CCW polygon)
            const [resultPolygon, result] = expandPolygon(edge, polygon.id, [50, -50], geometry);
            
            expect(resultPolygon).toBeDefined();
            expect(result.polygons.length).toBe(1);
            // Should still have 4 edges (parallel offset preserves edge count)
            expect(resultPolygon!.edges.length).toBe(4);

            // The polygon should be larger (expanded outward)
            const origBB = polygon.boundingBox;
            const resBB = resultPolygon!.boundingBox;
            const origArea = (origBB[1][0] - origBB[0][0]) * (origBB[1][1] - origBB[0][1]);
            const resArea = (resBB[1][0] - resBB[0][0]) * (resBB[1][1] - resBB[0][1]);
            expect(resArea).toBeGreaterThan(origArea);

            // Verify edges are parallel to originals
            const originalEdges = polygon.edges;
            const resultEdges = resultPolygon!.edges;
            for (let i = 0; i < originalEdges.length; i++) {
                const origDir = [
                    originalEdges[i].end.vector[0] - originalEdges[i].start.vector[0],
                    originalEdges[i].end.vector[1] - originalEdges[i].start.vector[1],
                ];
                const newDir = [
                    resultEdges[i].end.vector[0] - resultEdges[i].start.vector[0],
                    resultEdges[i].end.vector[1] - resultEdges[i].start.vector[1],
                ];
                // Normalize then cross product should be ~0 for parallel vectors
                const origLen = Math.sqrt(origDir[0] ** 2 + origDir[1] ** 2);
                const newLen = Math.sqrt(newDir[0] ** 2 + newDir[1] ** 2);
                const cross = (origDir[0] / origLen) * (newDir[1] / newLen) - (origDir[1] / origLen) * (newDir[0] / newLen);
                expect(Math.abs(cross)).toBeLessThan(0.01);
            }
        });

        it('contracts polygon when target is closer to center', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // top edge: (0,0) -> (100,0)
            
            // Target is between the edge and the center (inward)
            const [resultPolygon, result] = expandPolygon(edge, polygon.id, [50, 30], geometry);
            
            expect(resultPolygon).toBeDefined();
            expect(resultPolygon!.edges.length).toBe(4);

            // The polygon should be smaller: bounding box should be contained within original
            const origBB = polygon.boundingBox;
            const resBB = resultPolygon!.boundingBox;
            // result min should be >= original min and result max should be <= original max
            expect(resBB[0][0]).toBeGreaterThanOrEqual(origBB[0][0] - 0.01);
            expect(resBB[0][1]).toBeGreaterThanOrEqual(origBB[0][1] - 0.01);
            expect(resBB[1][0]).toBeLessThanOrEqual(origBB[1][0] + 0.01);
            expect(resBB[1][1]).toBeLessThanOrEqual(origBB[1][1] + 0.01);
        });

        it('preserves edge materials after expansion', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];
            
            const [resultPolygon] = expandPolygon(edge, polygon.id, [50, -20], geometry);
            
            // Each result edge should have material from the corresponding original edge
            resultPolygon!.edges.forEach((e, i) => {
                expect(e.material).toBeDefined();
            });
        });

        it('expands non-regular polygon with edges staying parallel', () => {
            // L-shaped polygon: edges at various angles
            const geometry = createGeometry([[[0, 0], [60, 0], [60, 40], [40, 40], [40, 80], [0, 80]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // bottom edge: (0,0) -> (60,0)
            
            // Expand outward
            const [resultPolygon] = expandPolygon(edge, polygon.id, [30, -20], geometry);
            
            expect(resultPolygon).toBeDefined();
            expect(resultPolygon!.edges.length).toBe(6);

            // Verify all edges remain parallel to their originals
            const originalEdges = polygon.edges;
            const resultEdges = resultPolygon!.edges;
            for (let i = 0; i < originalEdges.length; i++) {
                const origDir = [
                    originalEdges[i].end.vector[0] - originalEdges[i].start.vector[0],
                    originalEdges[i].end.vector[1] - originalEdges[i].start.vector[1],
                ];
                const newDir = [
                    resultEdges[i].end.vector[0] - resultEdges[i].start.vector[0],
                    resultEdges[i].end.vector[1] - resultEdges[i].start.vector[1],
                ];
                const origLen = Math.sqrt(origDir[0] ** 2 + origDir[1] ** 2);
                const newLen = Math.sqrt(newDir[0] ** 2 + newDir[1] ** 2);
                const cross = (origDir[0] / origLen) * (newDir[1] / newLen) - (origDir[1] / origLen) * (newDir[0] / newLen);
                expect(Math.abs(cross)).toBeLessThan(0.01);
            }
        });

        it('allows contracting past center without clamping', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];
            
            // Contract way past the center — should invert the polygon
            const [resultPolygon] = expandPolygon(edge, polygon.id, [50, 500], geometry);
            
            expect(resultPolygon).toBeDefined();
            expect(resultPolygon!.edges.length).toBe(4);
        });

        it('expands with null edge by using nearest edge to target', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            
            // Target is above the top edge (0,0)->(100,0), so the nearest edge is the top edge
            // Expanding outward (upward in screen coords = negative Y)
            const [resultPolygon] = expandPolygon(null, polygon.id, [50, -50], geometry);
            
            expect(resultPolygon).toBeDefined();
            expect(resultPolygon!.edges.length).toBe(4);

            // The polygon should be larger (expanded outward)
            const origBB = polygon.boundingBox;
            const resBB = resultPolygon!.boundingBox;
            const origArea = (origBB[1][0] - origBB[0][0]) * (origBB[1][1] - origBB[0][1]);
            const resArea = (resBB[1][0] - resBB[0][0]) * (resBB[1][1] - resBB[0][1]);
            expect(resArea).toBeGreaterThan(origArea);

            // Verify edges stay parallel to originals
            const originalEdges = polygon.edges;
            const resultEdges = resultPolygon!.edges;
            for (let i = 0; i < originalEdges.length; i++) {
                const origDir = [
                    originalEdges[i].end.vector[0] - originalEdges[i].start.vector[0],
                    originalEdges[i].end.vector[1] - originalEdges[i].start.vector[1],
                ];
                const newDir = [
                    resultEdges[i].end.vector[0] - resultEdges[i].start.vector[0],
                    resultEdges[i].end.vector[1] - resultEdges[i].start.vector[1],
                ];
                const origLen = Math.sqrt(origDir[0] ** 2 + origDir[1] ** 2);
                const newLen = Math.sqrt(newDir[0] ** 2 + newDir[1] ** 2);
                const cross = (origDir[0] / origLen) * (newDir[1] / newLen) - (origDir[1] / origLen) * (newDir[0] / newLen);
                expect(Math.abs(cross)).toBeLessThan(0.01);
            }
        });

        it('null edge produces same result as passing the nearest edge explicitly', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const target: [number, number] = [50, -30];
            
            // The nearest edge to target [50, -30] is edge 0: (0,0)->(100,0) (the top edge at y=0)
            const nearestEdge = polygon.edges[0];
            
            const [withEdge] = expandPolygon(nearestEdge, polygon.id, target, geometry);
            const [withNull] = expandPolygon(null, polygon.id, target, geometry);
            
            // Both should produce identical vertex positions
            expect(withNull!.edges.length).toBe(withEdge!.edges.length);
            for (let i = 0; i < withEdge!.edges.length; i++) {
                expect(withNull!.edges[i].start.vector[0]).toBeCloseTo(withEdge!.edges[i].start.vector[0], 5);
                expect(withNull!.edges[i].start.vector[1]).toBeCloseTo(withEdge!.edges[i].start.vector[1], 5);
                expect(withNull!.edges[i].end.vector[0]).toBeCloseTo(withEdge!.edges[i].end.vector[0], 5);
                expect(withNull!.edges[i].end.vector[1]).toBeCloseTo(withEdge!.edges[i].end.vector[1], 5);
            }
        });
    });

    describe('rotatePolygon', () => {
        it('rotates polygon around center', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const originalFirstVertex = polygon.vertices[0].vector.slice();
            
            // Rotate by targeting a point
            const result = rotatePolygon([polygon.id], [100, 50], geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            // First vertex should have moved
            expect(updatedPolygon.vertices[0].vector).not.toEqual(originalFirstVertex);
        });

        it('rotates multiple polygons together', () => {
            const geometry = createGeometry([
                [[0, 0], [50, 0], [50, 50], [0, 50]],
                [[50, 0], [100, 0], [100, 50], [50, 50]]
            ]);
            const poly1 = geometry.polygons[0];
            const poly2 = geometry.polygons[1];
            
            const result = rotatePolygon([poly1.id, poly2.id], [100, 100], geometry);
            
            expect(result.polygons.length).toBe(2);
        });
    });

    describe('reversePolygon', () => {
        it('reverses the winding order of polygon vertices', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const originalVertices = polygon.vertices.map(v => v.vector.slice());
            
            const result = reversePolygon([polygon.id], geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            // First vertex stays same, but rest are reversed
            expect(updatedPolygon.vertices[0].vector[0]).toBeCloseTo(originalVertices[0][0]);
            expect(updatedPolygon.vertices[1].vector[0]).toBeCloseTo(originalVertices[2][0]);
        });

        it('preserves edge materials when reversing', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const material = materialFactory.build();
            polygon.edges[0].material = material;
            
            const result = reversePolygon([polygon.id], geometry);
            
            const updatedPolygon = result.polygons.find(p => p.id === polygon.id)!;
            // At least one edge should have material
            const edgesWithMaterial = updatedPolygon.edges.filter(e => e.material != null);
            expect(edgesWithMaterial.length).toBeGreaterThan(0);
        });
    });

    describe('duplicatePolygons', () => {
        it('duplicates polygons with offset', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            
            const [result, newPolygons] = duplicatePolygons([polygon], [200, 0], geometry);
            
            expect(result.polygons.length).toBe(2);
            expect(newPolygons.length).toBe(1);
            expect(newPolygons[0].id).not.toBe(polygon.id);
        });

        it('offsets duplicated polygon vertices by delta', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            
            const [result, newPolygons] = duplicatePolygons([polygon], [200, 100], geometry);
            
            const newPolygon = newPolygons[0];
            // New polygon should have vertex near [200, 100]
            const hasOffsetVertex = newPolygon.vertices.some(v =>
                Math.abs(v.vector[0] - 200) < 1 && Math.abs(v.vector[1] - 100) < 1
            );
            expect(hasOffsetVertex).toBe(true);
        });

        it('duplicates multiple polygons', () => {
            const geometry = createGeometry([
                [[0, 0], [50, 0], [50, 50]],
                [[100, 0], [150, 0], [150, 50]]
            ]);
            
            const [result, newPolygons] = duplicatePolygons(geometry.polygons, [0, 100], geometry);
            
            expect(result.polygons.length).toBe(4);
            expect(newPolygons.length).toBe(2);
        });
    });

    describe('selectRegion', () => {
        it('selects entire polygons within region', () => {
            const geometry = createGeometry([
                [[10, 10], [40, 10], [40, 40], [10, 40]], // Small, inside region
                [[100, 100], [200, 100], [200, 200], [100, 200]] // Large, outside region
            ]);
            
            const region: BoundingBox = [[0, 0], [50, 50]];
            const selected = selectRegion(region, geometry);
            
            expect(selected.length).toBe(1);
            expect(isPolygon(selected[0])).toBe(true);
        });

        it('selects vertices within region from partially overlapping polygons', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            
            // Region that contains only some vertices
            const region: BoundingBox = [[-10, -10], [10, 10]];
            const selected = selectRegion(region, geometry);
            
            // Should select the vertex at [0,0] but not the whole polygon
            const vertices = selected.filter(isVertex);
            expect(vertices.length).toBeGreaterThan(0);
        });

        it('selects edges within region', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            
            // Region that contains an edge
            const region: BoundingBox = [[-10, -10], [110, 10]];
            const selected = selectRegion(region, geometry);
            
            // Should select edges that are fully within the region
            expect(selected.length).toBeGreaterThan(0);
        });

        it('returns empty array when region contains nothing', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            
            const region: BoundingBox = [[500, 500], [600, 600]];
            const selected = selectRegion(region, geometry);
            
            expect(selected.length).toBe(0);
        });
    });

    describe('queryVertex', () => {
        it('finds vertex by id in polygon', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const vertexId = polygon.vertices[0].id;
            
            const result = queryVertex(vertexId, polygon.id, geometry);
            
            expect(result).toBeDefined();
            expect(result.id).toBe(vertexId);
            expect(result.vector).toEqual([0, 0]);
        });

        it('returns undefined for non-existent vertex', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            
            const result = queryVertex('non-existent-id', polygon.id, geometry);
            
            expect(result).toBeUndefined();
        });
    });

    describe('queryEdge', () => {
        it('finds edge by id in polygon', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const edgeId = polygon.edges[0].id;
            
            const result = queryEdge(edgeId, polygon.id, geometry);
            
            expect(result).toBeDefined();
            expect(result.id).toBe(edgeId);
        });

        it('returns undefined for non-existent edge', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            
            const result = queryEdge('non-existent-id', polygon.id, geometry);
            
            expect(result).toBeUndefined();
        });
    });

    describe('queryPolygon', () => {
        it('finds polygon by id', () => {
            const geometry = createGeometry([
                [[0, 0], [100, 0], [100, 100]],
                [[200, 0], [300, 0], [300, 100]]
            ]);
            const polygonId = geometry.polygons[1].id;
            
            const result = queryPolygon(polygonId, geometry);
            
            expect(result).toBeDefined();
            expect(result.id).toBe(polygonId);
        });

        it('returns undefined for non-existent polygon', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            
            const result = queryPolygon('non-existent-id', geometry);
            
            expect(result).toBeUndefined();
        });
    });

    describe('storeGeometry', () => {
        it('stores geometry with polygon data', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            geometry.id = 'test-geometry-id';
            
            const stored = storeGeometry(geometry);
            
            expect(stored.id).toBe('test-geometry-id');
            expect(stored.polygons.length).toBe(1);
        });

        it('BSP is no longer stored on geometry', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            
            const stored = storeGeometry(geometry);
            
            // BSP is managed externally by bspState, not stored on geometry
            expect((stored as any).bsp).toBeUndefined();
        });
    });

    describe('addPolygon', () => {
        it('adds polygon to geometry', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const newPolygon = polygons.square(200, 200, 50);
            
            const result = addPolygon(newPolygon, geometry);
            
            expect(result.polygons.length).toBe(2);
            expect(result.polygons).toContain(newPolygon);
        });

        it('increments edge count', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const originalEdgeCount = geometry.edgeCount;
            const newPolygon = polygons.square(200, 200, 50);
            
            const result = addPolygon(newPolygon, geometry);
            
            expect(result.edgeCount).toBe(originalEdgeCount + 1);
        });
    });

    describe('detectCollisionAt (geometry wrapper)', () => {
        it('delegates to collision module', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            
            const result = detectCollisionAt([5, 5], geometry);
            
            expect(result).toBeDefined();
        });

        it('returns undefined when no collision', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            
            const result = detectCollisionAt([500, 500], geometry);
            
            expect(result).toBeUndefined();
        });
    });

    describe('EMPTY_GEOMETRY constant', () => {
        it('has no polygons', () => {
            expect(EMPTY_GEOMETRY.polygons).toEqual([]);
        });

        it('has zero edge count', () => {
            expect(EMPTY_GEOMETRY.edgeCount).toBe(0);
        });

        it('has zero bounds', () => {
            expect(EMPTY_GEOMETRY.bounds).toEqual([0, 0]);
        });
    });

    // ===========================================================================
    // New geometry operations tests
    // ===========================================================================

    describe('subdivideEdge', () => {
        it('splits an edge into N equal segments', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // (0,0)->(100,0)

            const result = subdivideEdge(edge, polygon.id, 3, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // 4 original edges, edge[0] replaced by 3 => 6 total
            expect(updated.edges.length).toBe(6);
        });

        it('creates evenly spaced vertices', () => {
            const geometry = createGeometry([[[0, 0], [90, 0], [90, 90], [0, 90]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // (0,0)->(90,0)

            const result = subdivideEdge(edge, polygon.id, 3, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Should have vertices at x=0, 30, 60, 90
            const xCoords = updated.vertices.map(v => v.vector[0]).sort((a, b) => a - b);
            expect(xCoords).toContainEqual(0);
            expect(xCoords.some(x => Math.abs(x - 30) < 0.01)).toBe(true);
            expect(xCoords.some(x => Math.abs(x - 60) < 0.01)).toBe(true);
        });

        it('preserves materials on subdivided edges', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];

            const result = subdivideEdge(edge, polygon.id, 2, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // All edges should have material
            updated.edges.forEach(e => expect(e.material).toBeDefined());
        });

        it('returns geometry unchanged for segments < 2', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];

            const result = subdivideEdge(edge, polygon.id, 1, geometry);
            expect(result).toBe(geometry);
        });
    });

    describe('extrudeEdge', () => {
        it('creates a rectangular extrusion', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // (0,0)->(100,0)

            // Target above the edge (outward for CCW polygon)
            const result = extrudeEdge(edge, polygon.id, [50, -30], geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Original edge replaced by 3 edges (side1, front, side2) => 4 - 1 + 3 = 6
            expect(updated.edges.length).toBe(6);
        });

        it('adds 2 new vertices at extruded positions', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];

            const result = extrudeEdge(edge, polygon.id, [50, -50], geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Should have 6 vertices (4 original + 2 new)
            expect(updated.vertices.length).toBe(6);
        });

        it('preserves edge materials', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];

            const result = extrudeEdge(edge, polygon.id, [50, -30], geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            updated.edges.forEach(e => expect(e.material).toBeDefined());
        });
    });

    describe('bevelVertex', () => {
        it('replaces a vertex with a chamfer edge (segments=1)', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const vertex = polygon.vertices[1]; // vertex at (100, 0)

            const result = bevelVertex(vertex, polygon.id, 20, 1, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // 4 original edges + 1 new chamfer edge - but the incoming and outgoing are truncated
            // net result: 4 edges become 5 (incoming truncated + chamfer + outgoing truncated + 2 unchanged)
            expect(updated.edges.length).toBe(5);
        });

        it('creates multiple edges for bevel (segments > 1)', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const vertex = polygon.vertices[1]; // (100, 0)

            const result = bevelVertex(vertex, polygon.id, 20, 4, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // 4 edges become: 2 unchanged + 1 truncated incoming + 4 bevel edges + 1 truncated outgoing = 8
            expect(updated.edges.length).toBe(8);
        });

        it('does nothing for distance <= 0', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const vertex = polygon.vertices[0];

            const result = bevelVertex(vertex, polygon.id, 0, 1, geometry);
            expect(result).toBe(geometry);
        });
    });

    describe('insetEdge', () => {
        it('replaces an edge with 5 edges forming a recess', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // (0,0)->(100,0)

            const result = insetEdge(edge, polygon.id, 20, 0.5, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // 4 original edges, edge[0] replaced by 5 => 8 total
            expect(updated.edges.length).toBe(8);
        });

        it('creates inset vertices at the correct depth', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0]; // top edge at y=0

            const result = insetEdge(edge, polygon.id, 20, 0.5, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // The inset vertices should be pushed inward (positive Y direction for CCW polygon top edge)
            const insetVerts = updated.vertices.filter(v =>
                Math.abs(v.vector[1] - 20) < 1
            );
            expect(insetVerts.length).toBeGreaterThanOrEqual(2);
        });

        it('preserves materials on all new edges', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];

            const result = insetEdge(edge, polygon.id, 10, 0.5, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            updated.edges.forEach(e => expect(e.material).toBeDefined());
        });
    });

    describe('flipPolygon', () => {
        it('flips polygon horizontally', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 50], [0, 50]]]);
            const polygon = geometry.polygons[0];
            const center = [(0 + 100) / 2, (0 + 50) / 2]; // [50, 25]

            const result = flipPolygon([polygon.id], 'horizontal', geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Each vertex's X should be reflected about the center X
            const origVerts = polygon.vertices.map(v => v.vector);
            const newVerts = updated.vertices.map(v => v.vector);

            // Bounding box should remain the same size
            const origBB = polygon.boundingBox;
            const newBB = updated.boundingBox;
            const origWidth = origBB[1][0] - origBB[0][0];
            const newWidth = newBB[1][0] - newBB[0][0];
            expect(Math.abs(origWidth - newWidth)).toBeLessThan(0.01);
        });

        it('flips polygon vertically', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [50, 80]]]);
            const polygon = geometry.polygons[0];

            const result = flipPolygon([polygon.id], 'vertical', geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Bounding box height should be preserved
            const origHeight = polygon.boundingBox[1][1] - polygon.boundingBox[0][1];
            const newHeight = updated.boundingBox[1][1] - updated.boundingBox[0][1];
            expect(Math.abs(origHeight - newHeight)).toBeLessThan(0.01);
        });

        it('preserves edge count', () => {
            const geometry = createGeometry([[[0, 0], [60, 0], [60, 40], [40, 40], [40, 80], [0, 80]]]);
            const polygon = geometry.polygons[0];

            const result = flipPolygon([polygon.id], 'horizontal', geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            expect(updated.edges.length).toBe(polygon.edges.length);
        });
    });

    describe('scalePolygon', () => {
        it('scales polygon uniformly', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];

            const result = scalePolygon([polygon.id], 2, 2, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Bounding box should be 2x in each dimension
            const origWidth = polygon.boundingBox[1][0] - polygon.boundingBox[0][0];
            const newWidth = updated.boundingBox[1][0] - updated.boundingBox[0][0];
            expect(newWidth).toBeCloseTo(origWidth * 2, 1);
        });

        it('scales non-uniformly', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];

            const result = scalePolygon([polygon.id], 2, 0.5, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            const origWidth = polygon.boundingBox[1][0] - polygon.boundingBox[0][0];
            const origHeight = polygon.boundingBox[1][1] - polygon.boundingBox[0][1];
            const newWidth = updated.boundingBox[1][0] - updated.boundingBox[0][0];
            const newHeight = updated.boundingBox[1][1] - updated.boundingBox[0][1];

            expect(newWidth).toBeCloseTo(origWidth * 2, 1);
            expect(newHeight).toBeCloseTo(origHeight * 0.5, 1);
        });

        it('preserves center position', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const origCenter = centerOf(polygon.boundingBox);

            const result = scalePolygon([polygon.id], 3, 3, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;
            const newCenter = centerOf(updated.boundingBox);

            expect(newCenter[0]).toBeCloseTo(origCenter[0], 1);
            expect(newCenter[1]).toBeCloseTo(origCenter[1], 1);
        });
    });

    describe('regularizePolygon', () => {
        it('creates a polygon with equal edge lengths', () => {
            // Irregular quadrilateral
            const geometry = createGeometry([[[0, 0], [120, 0], [80, 90], [10, 70]]]);
            const polygon = geometry.polygons[0];

            const result = regularizePolygon(polygon.id, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            expect(updated.edges.length).toBe(4);

            // All edges should have approximately equal length
            const lengths = updated.edges.map(e => e.length);
            const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
            lengths.forEach(l => expect(Math.abs(l - avgLen) / avgLen).toBeLessThan(0.01));
        });

        it('preserves vertex count', () => {
            const geometry = createGeometry([[[0, 0], [50, 0], [80, 30], [80, 70], [50, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];

            const result = regularizePolygon(polygon.id, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            expect(updated.vertices.length).toBe(polygon.vertices.length);
        });
    });

    describe('convexHull', () => {
        it('removes concavities from an L-shaped polygon', () => {
            // L-shape has a concavity
            const geometry = createGeometry([[[0, 0], [60, 0], [60, 40], [40, 40], [40, 80], [0, 80]]]);
            const polygon = geometry.polygons[0];

            const result = convexHull(polygon.id, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Convex hull of L-shape should have fewer vertices
            expect(updated.vertices.length).toBeLessThanOrEqual(polygon.vertices.length);
            // And should be convex
            // Simple convexity test: all cross products of consecutive edges have same sign
            const verts = updated.vertices.map(v => v.vector);
            let sign = 0;
            let isConvex = true;
            for (let i = 0; i < verts.length; i++) {
                const a = verts[i];
                const b = verts[(i + 1) % verts.length];
                const c = verts[(i + 2) % verts.length];
                const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
                if (cross !== 0) {
                    if (sign === 0) sign = Math.sign(cross);
                    else if (Math.sign(cross) !== sign) isConvex = false;
                }
            }
            expect(isConvex).toBe(true);
        });

        it('leaves a convex polygon unchanged in vertex count', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];

            const result = convexHull(polygon.id, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            expect(updated.vertices.length).toBe(4);
        });
    });

    describe('insetPolygon', () => {
        it('creates a new inner polygon', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];

            const [inner, result] = insetPolygon(polygon.id, 10, geometry);

            expect(result.polygons.length).toBe(2);
            expect(inner).toBeDefined();
            expect(inner!.id).not.toBe(polygon.id);
        });

        it('inner polygon is smaller than outer', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];

            const [inner] = insetPolygon(polygon.id, 10, geometry);

            const outerArea = (polygon.boundingBox[1][0] - polygon.boundingBox[0][0]) *
                              (polygon.boundingBox[1][1] - polygon.boundingBox[0][1]);
            const innerArea = (inner!.boundingBox[1][0] - inner!.boundingBox[0][0]) *
                              (inner!.boundingBox[1][1] - inner!.boundingBox[0][1]);

            expect(innerArea).toBeLessThan(outerArea);
        });

        it('preserves materials on inner polygon', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];

            const [inner] = insetPolygon(polygon.id, 10, geometry);

            inner!.edges.forEach(e => expect(e.material).toBeDefined());
        });
    });

    describe('mergePolygons', () => {
        it('combines two adjacent polygons sharing an edge', () => {
            // Two rectangles side by side sharing the edge at x=50
            const geometry = createGeometry([
                [[0, 0], [50, 0], [50, 100], [0, 100]],
                [[50, 0], [100, 0], [100, 100], [50, 100]]
            ]);

            const result = mergePolygons(
                geometry.polygons.map(p => p.id),
                geometry
            );

            // Should result in a single polygon
            expect(result.polygons.length).toBe(1);
        });

        it('returns geometry unchanged if no shared edges', () => {
            const geometry = createGeometry([
                [[0, 0], [40, 0], [40, 40], [0, 40]],
                [[100, 100], [140, 100], [140, 140], [100, 140]]
            ]);

            const result = mergePolygons(
                geometry.polygons.map(p => p.id),
                geometry
            );

            // No shared edges, so nothing changes
            expect(result.polygons.length).toBe(2);
        });

        it('does nothing with fewer than 2 polygons', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);

            const result = mergePolygons([geometry.polygons[0].id], geometry);

            expect(result).toBe(geometry);
        });
    });

    describe('alignVertices', () => {
        it('aligns vertices horizontally to average Y', () => {
            const geometry = createGeometry([[[0, 10], [100, 30], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const verticesToAlign = [polygon.vertices[0], polygon.vertices[1]]; // y=10 and y=30

            const vertexMap: IVertexMap = new Map([[polygon.id, verticesToAlign]]);
            const result = alignVertices('horizontal', vertexMap, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Average Y of 10 and 30 = 20
            const alignedVerts = updated.vertices.filter(v =>
                Math.abs(v.vector[1] - 20) < 0.01
            );
            expect(alignedVerts.length).toBe(2);
        });

        it('aligns vertices vertically to average X', () => {
            const geometry = createGeometry([[[10, 0], [30, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const verticesToAlign = [polygon.vertices[0], polygon.vertices[1]]; // x=10 and x=30

            const vertexMap: IVertexMap = new Map([[polygon.id, verticesToAlign]]);
            const result = alignVertices('vertical', vertexMap, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Average X of 10 and 30 = 20
            const alignedVerts = updated.vertices.filter(v =>
                Math.abs(v.vector[0] - 20) < 0.01
            );
            expect(alignedVerts.length).toBe(2);
        });
    });

    describe('alignPolygons', () => {
        it('aligns polygons to top of combined bounding box', () => {
            const geometry = createGeometry([
                [[0, 10], [50, 10], [50, 60], [0, 60]],
                [[100, 30], [150, 30], [150, 80], [100, 80]]
            ]);

            const result = alignPolygons(
                geometry.polygons.map(p => p.id),
                'top',
                geometry
            );

            // Both polygons should have the same min Y
            const p1 = result.polygons[0];
            const p2 = result.polygons[1];
            expect(p1.boundingBox[0][1]).toBeCloseTo(p2.boundingBox[0][1], 1);
        });

        it('aligns polygons to right of combined bounding box', () => {
            const geometry = createGeometry([
                [[0, 0], [50, 0], [50, 50], [0, 50]],
                [[100, 0], [200, 0], [200, 50], [100, 50]]
            ]);

            const result = alignPolygons(
                geometry.polygons.map(p => p.id),
                'right',
                geometry
            );

            const p1 = result.polygons[0];
            const p2 = result.polygons[1];
            expect(p1.boundingBox[1][0]).toBeCloseTo(p2.boundingBox[1][0], 1);
        });

        it('does nothing with fewer than 2 polygons', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);

            const result = alignPolygons([geometry.polygons[0].id], 'top', geometry);

            expect(result).toBe(geometry);
        });
    });

    describe('weldVertices', () => {
        it('merges two adjacent vertices to centroid and removes zero-length edge', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const v1 = polygon.vertices[0]; // (0, 0)
            const v2 = polygon.vertices[1]; // (100, 0)

            const vertexMap: IVertexMap = new Map([[polygon.id, [v1, v2]]]);
            const result = weldVertices(vertexMap, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // The edge between v1 and v2 should be removed (zero-length)
            expect(updated.edges.length).toBe(3);
            // The welded vertex should be at centroid (50, 0)
            const weldedVerts = updated.vertices.filter(v =>
                Math.abs(v.vector[0] - 50) < 0.01 && Math.abs(v.vector[1]) < 0.01
            );
            expect(weldedVerts.length).toBe(1);
        });

        it('merges three adjacent vertices and removes zero-length edges', () => {
            // Pentagon: 5 vertices, weld 3 adjacent ones
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [50, 150], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const v0 = polygon.vertices[0]; // (0, 0)
            const v1 = polygon.vertices[1]; // (100, 0)
            const v2 = polygon.vertices[2]; // (100, 100)

            const vertexMap: IVertexMap = new Map([[polygon.id, [v0, v1, v2]]]);
            const result = weldVertices(vertexMap, geometry);
            const updated = result.polygons.find(p => p.id === polygon.id)!;

            // Two edges between the three welded vertices should be removed
            expect(updated.edges.length).toBe(3);
        });

        it('does nothing with fewer than 2 vertices', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];

            const vertexMap: IVertexMap = new Map([[polygon.id, [polygon.vertices[0]]]]);
            const result = weldVertices(vertexMap, geometry);

            expect(result).toBe(geometry);
        });

        it('removes polygon when all vertices are welded', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            const polygon = geometry.polygons[0];

            const vertexMap: IVertexMap = new Map([[polygon.id, polygon.vertices]]);
            const result = weldVertices(vertexMap, geometry);

            // All edges become zero-length, polygon should be removed
            expect(result.polygons.length).toBe(0);
        });
    });

    describe('createRegularPolygon', () => {
        it('creates a triangle', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);

            const result = createRegularPolygon([200, 200], 50, 3, geometry);

            expect(result.polygons.length).toBe(2); // original + new
            const newPoly = result.polygons[result.polygons.length - 1];
            expect(newPoly.edges.length).toBe(3);
        });

        it('creates a hexagon with equal edge lengths', () => {
            const geometry = EMPTY_GEOMETRY;

            const result = createRegularPolygon([100, 100], 50, 6, geometry);

            expect(result.polygons.length).toBe(1);
            const poly = result.polygons[0];
            expect(poly.edges.length).toBe(6);

            // All edges should have approximately equal length
            const lengths = poly.edges.map(e => e.length);
            const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
            lengths.forEach(l => expect(Math.abs(l - avgLen) / avgLen).toBeLessThan(0.01));
        });

        it('does nothing for sides < 3', () => {
            const result = createRegularPolygon([0, 0], 50, 2, EMPTY_GEOMETRY);
            expect(result.polygons.length).toBe(0);
        });

        it('does nothing for radius <= 0', () => {
            const result = createRegularPolygon([0, 0], 0, 5, EMPTY_GEOMETRY);
            expect(result.polygons.length).toBe(0);
        });

        it('centers the polygon correctly', () => {
            const result = createRegularPolygon([200, 300], 50, 4, EMPTY_GEOMETRY);
            const poly = result.polygons[0];
            const center = centerOf(poly.boundingBox);

            expect(center[0]).toBeCloseTo(200, 0);
            expect(center[1]).toBeCloseTo(300, 0);
        });
    });
});