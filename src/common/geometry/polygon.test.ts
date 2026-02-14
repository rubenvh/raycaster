import { 
    createPolygon, IPolygon, isConvex, loadPolygon, storePolygon,
    BoundingBox, normalize, merge, contains, containsEdge, containsVertex, centerOf
} from './polygon';
import { makeEdge } from './edge';
import { makeVertex } from './vertex';
import { Vector } from '../math/vector';

describe('polygon tests', () => {
    describe('isConvex', () => {
        const invokeSut = (polygon: IPolygon) => isConvex(polygon);

        describe('convex polygons return true', () => {
            it('any triangle is always convex', () => {                
                expect(invokeSut(createPolygon([[0,0], [0,1], [1,0]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0], [1,0], [0,1]]))).toBe(true);
                expect(invokeSut(createPolygon([[5,2], [7,1], [-10,7]]))).toBe(true);                
            }); 
            it('rectangles are always convex', () => {                
                expect(invokeSut(createPolygon([[0,0],[0,1],[1,1],[1,0]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0],[0,8],[4,8],[4,0]]))).toBe(true);
            });            
            it('rectangles are always convex - reversed', () => {
                expect(invokeSut(createPolygon([[0,0],[1,0],[1,1],[0,1]]))).toBe(true);
            });
            it('colinear splits do not make polygons concave - horizontal split', () => {                                
                expect(invokeSut(createPolygon([[0,0], [0,1], [1,1],[2,1],[2,0]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0], [0,1], [2,1],[2,0],[1,0]]))).toBe(true);
            }); 
            it('colinear splits do not make polygons concave - vertical split', () => {                
                expect(invokeSut(createPolygon([[0,0],[2,0],[2,1],[2,2],[0,2]]))).toBe(true);
                expect(invokeSut(createPolygon([[0,0], [0,1], [0,2],[2,2],[2,0]]))).toBe(true);
            });            
            
        });

        describe('concave polygons return false', () => {
            it('vierhoek', () => {                
                expect(invokeSut(createPolygon([[1,1],[0,1],[5,5],[1,0]]))).toBe(false);
                // reversed:
                expect(invokeSut(createPolygon([[1,1],[1,0],[5,5],[0,1]]))).toBe(false);
            }); 
            it('vijfhoek', () => {                
                expect(invokeSut(createPolygon([[0,0],[0,2],[1,1],[2,2],[2,0]]))).toBe(false);
                // reversed:
            expect(invokeSut(createPolygon([[0,0],[2,0],[2,2],[1,1],[0,2]]))).toBe(false);
            }); 
        });
    });

    describe('createPolygon', () => {
        it('creates polygon from vectors', () => {
            const polygon = createPolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
            
            expect(polygon.edges.length).toBe(4);
            expect(polygon.vertices.length).toBe(4);
            expect(polygon.edgeCount).toBe(4);
        });

        it('calculates bounding box', () => {
            const polygon = createPolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
            
            expect(polygon.boundingBox[0]).toEqual([0, 0]);
            expect(polygon.boundingBox[1]).toEqual([10, 10]);
        });

        it('assigns id to polygon', () => {
            const polygon = createPolygon([[0, 0], [10, 0], [5, 10]]);
            expect(polygon.id).toBeDefined();
        });

        it('creates triangle', () => {
            const polygon = createPolygon([[0, 0], [10, 0], [5, 10]]);
            
            expect(polygon.edges.length).toBe(3);
            expect(polygon.vertices.length).toBe(3);
        });
    });

    describe('storePolygon and loadPolygon', () => {
        it('round-trips polygon through store/load', () => {
            const original = createPolygon([[0, 0], [10, 0], [10, 10], [0, 10]]);
            const stored = storePolygon(original);
            const loaded = loadPolygon(stored);
            
            expect(loaded.edges.length).toBe(original.edges.length);
            expect(loaded.edgeCount).toBe(original.edgeCount);
        });

        it('preserves polygon id', () => {
            const original = createPolygon([[0, 0], [10, 0], [5, 10]]);
            const stored = storePolygon(original);
            const loaded = loadPolygon(stored);
            
            expect(loaded.id).toBe(original.id);
        });

        it('recalculates bounding box on load', () => {
            const original = createPolygon([[5, 5], [15, 5], [15, 15], [5, 15]]);
            const stored = storePolygon(original);
            const loaded = loadPolygon(stored);
            
            expect(loaded.boundingBox[0]).toEqual([5, 5]);
            expect(loaded.boundingBox[1]).toEqual([15, 15]);
        });
    });

    describe('BoundingBox operations', () => {
        describe('normalize', () => {
            it('normalizes already normalized box', () => {
                const box: BoundingBox = [[0, 0], [10, 10]];
                expect(normalize(box)).toEqual([[0, 0], [10, 10]]);
            });

            it('swaps min/max when inverted', () => {
                const box: BoundingBox = [[10, 10], [0, 0]];
                const result = normalize(box);
                expect(result[0]).toEqual([0, 0]);
                expect(result[1]).toEqual([10, 10]);
            });

            it('handles mixed coordinates', () => {
                const box: BoundingBox = [[10, 0], [0, 10]];
                const result = normalize(box);
                expect(result[0]).toEqual([0, 0]);
                expect(result[1]).toEqual([10, 10]);
            });
        });

        describe('merge', () => {
            it('merges two non-overlapping boxes', () => {
                const b1: BoundingBox = [[0, 0], [5, 5]];
                const b2: BoundingBox = [[10, 10], [15, 15]];
                const result = merge(b1, b2);
                
                expect(result[0]).toEqual([0, 0]);
                expect(result[1]).toEqual([15, 15]);
            });

            it('merges overlapping boxes', () => {
                const b1: BoundingBox = [[0, 0], [10, 10]];
                const b2: BoundingBox = [[5, 5], [15, 15]];
                const result = merge(b1, b2);
                
                expect(result[0]).toEqual([0, 0]);
                expect(result[1]).toEqual([15, 15]);
            });

            it('merges contained box (no change)', () => {
                const b1: BoundingBox = [[0, 0], [20, 20]];
                const b2: BoundingBox = [[5, 5], [15, 15]];
                const result = merge(b1, b2);
                
                expect(result[0]).toEqual([0, 0]);
                expect(result[1]).toEqual([20, 20]);
            });
        });

        describe('contains', () => {
            it('returns true when region fully contains box', () => {
                const region: BoundingBox = [[0, 0], [20, 20]];
                const box: BoundingBox = [[5, 5], [15, 15]];
                expect(contains(region, box)).toBe(true);
            });

            it('returns false when box partially outside', () => {
                const region: BoundingBox = [[0, 0], [10, 10]];
                const box: BoundingBox = [[5, 5], [15, 15]];
                expect(contains(region, box)).toBe(false);
            });

            it('returns true for identical boxes', () => {
                const box: BoundingBox = [[0, 0], [10, 10]];
                expect(contains(box, box)).toBe(true);
            });

            it('returns false when box completely outside', () => {
                const region: BoundingBox = [[0, 0], [10, 10]];
                const box: BoundingBox = [[20, 20], [30, 30]];
                expect(contains(region, box)).toBe(false);
            });
        });

        describe('containsEdge', () => {
            it('returns true when edge fully inside box', () => {
                const edge = makeEdge([5, 5], [15, 15]);
                const box: BoundingBox = [[0, 0], [20, 20]];
                expect(containsEdge(edge, box)).toBe(true);
            });

            it('returns false when edge partially outside', () => {
                const edge = makeEdge([5, 5], [25, 25]);
                const box: BoundingBox = [[0, 0], [20, 20]];
                expect(containsEdge(edge, box)).toBe(false);
            });
        });

        describe('containsVertex', () => {
            it('returns true when vertex inside box', () => {
                const vertex = makeVertex([10, 10]);
                const box: BoundingBox = [[0, 0], [20, 20]];
                expect(containsVertex(vertex, box)).toBe(true);
            });

            it('returns false when vertex outside box', () => {
                const vertex = makeVertex([30, 30]);
                const box: BoundingBox = [[0, 0], [20, 20]];
                expect(containsVertex(vertex, box)).toBe(false);
            });

            it('returns true when vertex on boundary', () => {
                const vertex = makeVertex([0, 0]);
                const box: BoundingBox = [[0, 0], [20, 20]];
                expect(containsVertex(vertex, box)).toBe(true);
            });
        });

        describe('centerOf', () => {
            it('calculates center of box', () => {
                const box: BoundingBox = [[0, 0], [10, 10]];
                expect(centerOf(box)).toEqual([5, 5]);
            });

            it('handles offset box', () => {
                const box: BoundingBox = [[10, 20], [30, 40]];
                expect(centerOf(box)).toEqual([20, 30]);
            });

            it('handles negative coordinates', () => {
                const box: BoundingBox = [[-10, -10], [10, 10]];
                expect(centerOf(box)).toEqual([0, 0]);
            });
        });
    });    
});
  