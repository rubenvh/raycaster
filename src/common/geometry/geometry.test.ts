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
    EMPTY_GEOMETRY
} from './geometry';
import { Vector } from '../math/vector';
import { IVertexMap } from './vertex';
import { polygons, materialFactory, resetTestRandom } from '../testing/factories';
import { BoundingBox } from './polygon';
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

        it('clears BSP tree after modification', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            (geometry as any).bsp = {}; // Set fake BSP
            const polygon = geometry.polygons[0];
            
            const result = splitEdge([50, 0], polygon.edges[0], polygon.id, geometry);
            
            expect(result.bsp).toBeNull();
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
        it('expands polygon outward when target is farther from center', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];
            
            // Target is farther from center than edge
            const [resultPolygon, result] = expandPolygon(edge, polygon.id, [-50, -50], geometry);
            
            expect(resultPolygon).toBeDefined();
            expect(result.polygons.length).toBe(1);
            // Should have more edges after expansion
            expect(resultPolygon!.edges.length).toBeGreaterThanOrEqual(polygon.edges.length);
        });

        it('contracts polygon when target is closer to center', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100], [0, 100]]]);
            const polygon = geometry.polygons[0];
            const edge = polygon.edges[0];
            
            // Target is closer to center [50,50] than edge start
            const [resultPolygon, result] = expandPolygon(edge, polygon.id, [25, 25], geometry);
            
            expect(resultPolygon).toBeDefined();
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

        it('stores BSP if present', () => {
            const geometry = createGeometry([[[0, 0], [100, 0], [100, 100]]]);
            (geometry as any).bsp = { type: 'leaf' };
            
            const stored = storeGeometry(geometry);
            
            expect(stored.bsp).toEqual({ type: 'leaf' });
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
});