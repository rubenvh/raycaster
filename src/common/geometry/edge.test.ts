import { 
    IEdge, NULL_EDGE, makeEdge, loadEdge, storeEdge, 
    determineLuminosity, duplicateEdge, cloneEdge, clipEdge, createEdges
} from './edge';
import { Vector } from '../math/vector';
import { makeVertex } from './vertex';
import { Color, IMaterial } from './properties';

describe('edge tests', () => {
    describe('NULL_EDGE constant', () => {
        it('has zero start and end', () => {
            expect(NULL_EDGE.start.vector).toEqual([0, 0]);
            expect(NULL_EDGE.end.vector).toEqual([0, 0]);
        });

        it('has zero length', () => {
            expect(NULL_EDGE.length).toBe(0);
        });
    });

    describe('makeEdge', () => {
        it('creates edge from two vectors', () => {
            const edge = makeEdge([0, 0], [10, 0]);
            
            expect(edge.start.vector).toEqual([0, 0]);
            expect(edge.end.vector).toEqual([10, 0]);
        });

        it('calculates correct length', () => {
            const edge = makeEdge([0, 0], [3, 4]);
            expect(edge.length).toBe(5);
        });

        it('calculates segment', () => {
            const edge = makeEdge([0, 0], [10, 20]);
            expect(edge.segment).toEqual([[0, 0], [10, 20]]);
        });

        it('calculates slope for horizontal edge', () => {
            const edge = makeEdge([0, 0], [10, 0]);
            expect(edge.slope).toBe(0);
        });

        it('calculates slope for vertical edge', () => {
            const edge = makeEdge([0, 0], [0, 10]);
            expect(edge.slope).toBe(Infinity);
        });

        it('calculates slope for diagonal edge', () => {
            const edge = makeEdge([0, 0], [10, 10]);
            expect(edge.slope).toBe(1);
        });
    });

    describe('determineLuminosity', () => {
        it('returns 0.4 for horizontal edges (slope 0)', () => {
            expect(determineLuminosity(0)).toBe(0.4);
        });

        it('returns 1 for vertical edges (infinite slope)', () => {
            expect(determineLuminosity(Infinity)).toBe(1);
            expect(determineLuminosity(-Infinity)).toBe(1);
        });

        it('returns 0.7 for 45-degree edges (slope 1)', () => {
            // percentage=0.4, m=1, result = 0.4 + (1/(1+1)) * 0.6 = 0.4 + 0.3 = 0.7
            expect(determineLuminosity(1)).toBe(0.7);
            expect(determineLuminosity(-1)).toBe(0.7);
        });

        it('returns values between 0.4 and 1', () => {
            const slopes = [0, 0.5, 1, 2, 5, 10, 100];
            slopes.forEach(s => {
                const lum = determineLuminosity(s);
                expect(lum).toBeGreaterThanOrEqual(0.4);
                expect(lum).toBeLessThanOrEqual(1);
            });
        });

        it('handles NaN slope', () => {
            // NaN is treated as 0 in the formula due to || 0
            expect(determineLuminosity(NaN)).toBe(0.4);
        });
    });

    describe('loadEdge', () => {
        it('loads edge from stored edge', () => {
            const stored = {
                start: makeVertex([0, 0]),
                end: makeVertex([10, 0]),
                material: { color: [255, 0, 0, 1] as Color },
                immaterial: false
            };
            const edge = loadEdge(stored);
            
            expect(edge.start.vector).toEqual([0, 0]);
            expect(edge.end.vector).toEqual([10, 0]);
            expect(edge.length).toBe(10);
            expect(edge.material).toEqual(stored.material);
            expect(edge.immaterial).toBe(false);
        });

        it('calculates luminosity based on slope', () => {
            const horizontal = loadEdge({
                start: makeVertex([0, 0]),
                end: makeVertex([10, 0])
            });
            const vertical = loadEdge({
                start: makeVertex([0, 0]),
                end: makeVertex([0, 10])
            });
            
            expect(horizontal.luminosity).toBe(0.4);
            expect(vertical.luminosity).toBe(1);
        });
    });

    describe('storeEdge', () => {
        it('extracts storable properties from edge', () => {
            const edge = makeEdge([0, 0], [10, 0]);
            edge.material = { color: [255, 0, 0, 1] };
            edge.immaterial = true;
            
            const stored = storeEdge(edge);
            
            expect(stored.start).toBe(edge.start);
            expect(stored.end).toBe(edge.end);
            expect(stored.material).toBe(edge.material);
            expect(stored.immaterial).toBe(true);
            // Should not include computed properties
            expect((stored as any).length).toBeUndefined();
            expect((stored as any).slope).toBeUndefined();
            expect((stored as any).segment).toBeUndefined();
            expect((stored as any).luminosity).toBeUndefined();
        });
    });

    describe('duplicateEdge', () => {
        it('creates new edge with delta applied', () => {
            const original = makeEdge([0, 0], [10, 0]);
            original.material = { color: [255, 0, 0, 1] };
            
            const delta: Vector = [5, 5];
            const duplicate = duplicateEdge(original, delta);
            
            expect(duplicate.start.vector).toEqual([5, 5]);
            expect(duplicate.end.vector).toEqual([15, 5]);
        });

        it('assigns new identity', () => {
            const original = makeEdge([0, 0], [10, 0]);
            const duplicate = duplicateEdge(original, [0, 0]);
            
            expect(duplicate.id).toBeDefined();
            expect(duplicate.id).not.toBe(original.id);
        });

        it('clones material', () => {
            const original = makeEdge([0, 0], [10, 0]);
            original.material = { color: [255, 0, 0, 1] };
            
            const duplicate = duplicateEdge(original, [0, 0]);
            
            // Compare color array specifically (cloneMaterial adds texture/luminosity properties)
            expect((duplicate.material as IMaterial).color).toEqual([255, 0, 0, 1]);
            expect(duplicate.material).not.toBe(original.material);
        });

        it('preserves immaterial flag', () => {
            const original = makeEdge([0, 0], [10, 0]);
            original.immaterial = true;
            
            const duplicate = duplicateEdge(original, [0, 0]);
            
            expect(duplicate.immaterial).toBe(true);
        });
    });

    describe('cloneEdge', () => {
        it('clones edge with same vertices', () => {
            const original = makeEdge([0, 0], [10, 0]);
            original.material = { color: [255, 0, 0, 1] };
            
            const cloned = cloneEdge(original);
            
            expect(cloned.start.vector).toEqual([0, 0]);
            expect(cloned.end.vector).toEqual([10, 0]);
        });

        it('preserves id', () => {
            const original = makeEdge([0, 0], [10, 0]);
            original.id = 'test-id';
            
            const cloned = cloneEdge(original);
            
            expect(cloned.id).toBe('test-id');
        });

        it('allows overriding start position', () => {
            const original = makeEdge([0, 0], [10, 0]);
            const cloned = cloneEdge(original, [5, 5]);
            
            expect(cloned.start.vector).toEqual([5, 5]);
            expect(cloned.end.vector).toEqual([10, 0]);
        });

        it('allows overriding end position', () => {
            const original = makeEdge([0, 0], [10, 0]);
            const cloned = cloneEdge(original, undefined, [20, 20]);
            
            expect(cloned.start.vector).toEqual([0, 0]);
            expect(cloned.end.vector).toEqual([20, 20]);
        });

        it('recalculates length when position changes', () => {
            const original = makeEdge([0, 0], [10, 0]); // length 10
            const cloned = cloneEdge(original, [0, 0], [3, 4]); // length 5
            
            expect(cloned.length).toBe(5);
        });
    });

    describe('clipEdge', () => {
        it('creates copy of edge', () => {
            const original = makeEdge([0, 0], [10, 0]);
            original.material = { color: [255, 0, 0, 1] };
            
            const clipped = clipEdge(original);
            
            expect(clipped.start.vector).toEqual(original.start.vector);
            expect(clipped.end.vector).toEqual(original.end.vector);
            expect(clipped).not.toBe(original);
        });

        it('preserves id', () => {
            const original = makeEdge([0, 0], [10, 0]);
            original.id = 'original-id';
            
            const clipped = clipEdge(original);
            
            expect(clipped.id).toBe('original-id');
        });
    });

    describe('createEdges', () => {
        it('creates closed polygon from vectors', () => {
            const vectors: Vector[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
            const edges = createEdges(vectors);
            
            expect(edges.length).toBe(4);
            expect(edges[0].start.vector).toEqual([0, 0]);
            expect(edges[0].end.vector).toEqual([10, 0]);
            expect(edges[3].end.vector).toEqual([0, 0]); // closes back to start
        });

        it('creates triangle from 3 vectors', () => {
            const vectors: Vector[] = [[0, 0], [10, 0], [5, 10]];
            const edges = createEdges(vectors);
            
            expect(edges.length).toBe(3);
        });

        it('removes duplicate closing vertex', () => {
            // If last vertex equals first, it should be removed
            const vectors: Vector[] = [[0, 0], [10, 0], [10, 10], [0, 0]];
            const edges = createEdges(vectors);
            
            expect(edges.length).toBe(3);
        });

        it('gives identity to vertices', () => {
            const vectors: Vector[] = [[0, 0], [10, 0], [5, 10]];
            const edges = createEdges(vectors);
            
            edges.forEach(e => {
                expect(e.start.id).toBeDefined();
                expect(e.end.id).toBeDefined();
            });
        });

        it('shares vertices between consecutive edges', () => {
            const vectors: Vector[] = [[0, 0], [10, 0], [10, 10]];
            const edges = createEdges(vectors);
            
            // End of edge 0 should be same object as start of edge 1
            expect(edges[0].end).toBe(edges[1].start);
            expect(edges[1].end).toBe(edges[2].start);
        });

        it('assigns default material to edges', () => {
            const vectors: Vector[] = [[0, 0], [10, 0], [5, 10]];
            const edges = createEdges(vectors);
            
            edges.forEach(e => {
                expect(e.material).toBeDefined();
                expect((e.material as IMaterial).color).toBeDefined();
            });
        });
    });
});
