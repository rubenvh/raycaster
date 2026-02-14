import { 
    IVertex, NULL_VERTEX, makeVertex, distance, areEqual, areClose,
    duplicateVertex, cloneVertex
} from './vertex';
import { Vector } from '../math/vector';

describe('vertex tests', () => {
    describe('NULL_VERTEX constant', () => {
        it('has zero vector', () => {
            expect(NULL_VERTEX.vector).toEqual([0, 0]);
        });

        it('has no id', () => {
            expect(NULL_VERTEX.id).toBeUndefined();
        });
    });

    describe('makeVertex', () => {
        it('creates vertex from vector', () => {
            const v: Vector = [10, 20];
            const vertex = makeVertex(v);
            
            expect(vertex.vector).toBe(v);
            expect(vertex.id).toBeUndefined();
        });

        it('creates vertex from zero vector', () => {
            const vertex = makeVertex([0, 0]);
            expect(vertex.vector).toEqual([0, 0]);
        });

        it('creates vertex from negative coordinates', () => {
            const vertex = makeVertex([-5, -10]);
            expect(vertex.vector).toEqual([-5, -10]);
        });
    });

    describe('distance', () => {
        it('calculates distance between two vertices', () => {
            const v1 = makeVertex([0, 0]);
            const v2 = makeVertex([3, 4]);
            expect(distance(v1, v2)).toBe(5);
        });

        it('calculates distance from vertex to vector', () => {
            const vertex = makeVertex([0, 0]);
            const vector: Vector = [3, 4];
            expect(distance(vertex, vector)).toBe(5);
        });

        it('calculates distance from vector to vertex', () => {
            const vector: Vector = [0, 0];
            const vertex = makeVertex([3, 4]);
            expect(distance(vector, vertex)).toBe(5);
        });

        it('calculates distance between two vectors', () => {
            const v1: Vector = [0, 0];
            const v2: Vector = [3, 4];
            expect(distance(v1, v2)).toBe(5);
        });

        it('returns zero for same position', () => {
            const v1 = makeVertex([5, 5]);
            const v2 = makeVertex([5, 5]);
            expect(distance(v1, v2)).toBe(0);
        });
    });

    describe('areEqual', () => {
        it('returns true for vertices at same position', () => {
            const v1 = makeVertex([10, 20]);
            const v2 = makeVertex([10, 20]);
            expect(areEqual(v1, v2)).toBe(true);
        });

        it('returns false for vertices at different positions', () => {
            const v1 = makeVertex([10, 20]);
            const v2 = makeVertex([10, 21]);
            expect(areEqual(v1, v2)).toBe(false);
        });

        it('returns true for NULL_VERTEX compared to zero vertex', () => {
            const zero = makeVertex([0, 0]);
            expect(areEqual(NULL_VERTEX, zero)).toBe(true);
        });
    });

    describe('areClose', () => {
        it('returns true for vertices within epsilon', () => {
            const v1 = makeVertex([10, 20]);
            const v2 = makeVertex([10.001, 20.001]);
            expect(areClose(v1, v2)).toBe(true);
        });

        it('returns false for vertices outside epsilon', () => {
            const v1 = makeVertex([10, 20]);
            const v2 = makeVertex([10.1, 20.1]);
            expect(areClose(v1, v2)).toBe(false);
        });

        it('respects custom epsilon', () => {
            const v1 = makeVertex([10, 20]);
            const v2 = makeVertex([10.5, 20]);
            
            expect(areClose(v1, v2, 0.1)).toBe(false);
            expect(areClose(v1, v2, 1.0)).toBe(true);
        });

        it('works with vectors', () => {
            const vertex = makeVertex([10, 20]);
            const vector: Vector = [10.001, 20.001];
            expect(areClose(vertex, vector)).toBe(true);
        });

        it('returns true for identical positions', () => {
            const v1 = makeVertex([5, 5]);
            const v2 = makeVertex([5, 5]);
            expect(areClose(v1, v2)).toBe(true);
        });
    });

    describe('duplicateVertex', () => {
        it('creates new vertex with same position', () => {
            const original = makeVertex([10, 20]);
            const duplicate = duplicateVertex(original);
            
            expect(duplicate.vector).toEqual([10, 20]);
            expect(duplicate.vector).not.toBe(original.vector); // deep copy
        });

        it('assigns new identity', () => {
            const original = makeVertex([10, 20]);
            const duplicate = duplicateVertex(original);
            
            expect(duplicate.id).toBeDefined();
        });

        it('applies delta when provided', () => {
            const original = makeVertex([10, 20]);
            const delta: Vector = [5, -5];
            const duplicate = duplicateVertex(original, delta);
            
            expect(duplicate.vector).toEqual([15, 15]);
        });

        it('does not modify original vertex', () => {
            const original = makeVertex([10, 20]);
            duplicateVertex(original, [5, 5]);
            
            expect(original.vector).toEqual([10, 20]);
        });
    });

    describe('cloneVertex', () => {
        it('creates vertex with same position', () => {
            const original: IVertex = { vector: [10, 20], id: 'test-id' };
            const cloned = cloneVertex(original);
            
            expect(cloned.vector).toEqual([10, 20]);
        });

        it('preserves id', () => {
            const original: IVertex = { vector: [10, 20], id: 'test-id' };
            const cloned = cloneVertex(original);
            
            expect(cloned.id).toBe('test-id');
        });

        it('creates deep copy of vector', () => {
            const original: IVertex = { vector: [10, 20], id: 'test-id' };
            const cloned = cloneVertex(original);
            
            expect(cloned.vector).not.toBe(original.vector);
            cloned.vector[0] = 999;
            expect(original.vector[0]).toBe(10);
        });

        it('creates new object', () => {
            const original: IVertex = { vector: [10, 20], id: 'test-id' };
            const cloned = cloneVertex(original);
            
            expect(cloned).not.toBe(original);
        });
    });
});
