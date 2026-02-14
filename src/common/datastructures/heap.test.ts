import { Heap, left, right, parentNode } from './heap';
import { swap } from './utils';

describe('utils tests', () => {
    describe('swap function', () => {
        it('swaps two elements in array', () => {
            const arr = [1, 2, 3, 4, 5];
            swap(arr, 0, 4);
            expect(arr).toEqual([5, 2, 3, 4, 1]);
        });

        it('swapping same index does nothing', () => {
            const arr = [1, 2, 3];
            swap(arr, 1, 1);
            expect(arr).toEqual([1, 2, 3]);
        });

        it('returns the modified array', () => {
            const arr = [1, 2];
            const result = swap(arr, 0, 1);
            expect(result).toBe(arr);
        });

        it('works with objects', () => {
            const a = { val: 'a' };
            const b = { val: 'b' };
            const arr = [a, b];
            swap(arr, 0, 1);
            expect(arr[0]).toBe(b);
            expect(arr[1]).toBe(a);
        });
    });
});

describe('heap index helper tests', () => {
    describe('left child index', () => {
        it('left(0) = 1', () => expect(left(0)).toBe(1));
        it('left(1) = 3', () => expect(left(1)).toBe(3));
        it('left(2) = 5', () => expect(left(2)).toBe(5));
        it('left(3) = 7', () => expect(left(3)).toBe(7));
    });

    describe('right child index', () => {
        it('right(0) = 2', () => expect(right(0)).toBe(2));
        it('right(1) = 4', () => expect(right(1)).toBe(4));
        it('right(2) = 6', () => expect(right(2)).toBe(6));
        it('right(3) = 8', () => expect(right(3)).toBe(8));
    });

    describe('parent node index', () => {
        it('parentNode(0) = 0 (root has no parent, returns 0)', () => expect(parentNode(0)).toBe(0));
        it('parentNode(1) = 0', () => expect(parentNode(1)).toBe(0));
        it('parentNode(2) = 0', () => expect(parentNode(2)).toBe(0));
        it('parentNode(3) = 1', () => expect(parentNode(3)).toBe(1));
        it('parentNode(4) = 1', () => expect(parentNode(4)).toBe(1));
        it('parentNode(5) = 2', () => expect(parentNode(5)).toBe(2));
        it('parentNode(6) = 2', () => expect(parentNode(6)).toBe(2));
    });
});

describe('Heap class tests', () => {
    describe('constructor and buildHeap', () => {
        it('creates empty heap', () => {
            const heap = new Heap<number>([]);
            expect(heap.heapSize).toBe(0);
        });

        it('creates heap from single element', () => {
            const heap = new Heap<number>([5]);
            expect(heap.heapSize).toBe(1);
            expect(heap.max()).toBe(5);
        });

        it('creates max-heap from unsorted array', () => {
            const heap = new Heap<number>([3, 1, 4, 1, 5, 9, 2, 6]);
            expect(heap.max()).toBe(9);
        });

        it('maintains heap property after construction', () => {
            const heap = new Heap<number>([3, 1, 4, 1, 5, 9, 2, 6]);
            // Verify max-heap property: parent >= children
            for (let i = 0; i < Math.floor(heap.heapSize / 2); i++) {
                const l = left(i);
                const r = right(i);
                if (l < heap.heapSize) {
                    expect(heap.items[i]).toBeGreaterThanOrEqual(heap.items[l]);
                }
                if (r < heap.heapSize) {
                    expect(heap.items[i]).toBeGreaterThanOrEqual(heap.items[r]);
                }
            }
        });
    });

    describe('custom comparer', () => {
        it('creates min-heap with reversed comparer', () => {
            const minHeap = new Heap<number>([3, 1, 4, 1, 5, 9], (a, b) => b - a);
            expect(minHeap.max()).toBe(1); // "max" is actually min with reversed comparer
        });

        it('works with objects using custom comparer', () => {
            const items = [
                { name: 'a', priority: 3 },
                { name: 'b', priority: 1 },
                { name: 'c', priority: 5 },
            ];
            const heap = new Heap(items, (a, b) => a.priority - b.priority);
            expect(heap.max().name).toBe('c');
            expect(heap.max().priority).toBe(5);
        });
    });

    describe('insert', () => {
        it('inserts into empty heap', () => {
            const heap = new Heap<number>([]);
            heap.insert(5);
            expect(heap.heapSize).toBe(1);
            expect(heap.max()).toBe(5);
        });

        it('inserts new maximum', () => {
            const heap = new Heap<number>([1, 2, 3]);
            heap.insert(10);
            expect(heap.max()).toBe(10);
        });

        it('inserts non-maximum element', () => {
            const heap = new Heap<number>([10, 5, 3]);
            heap.insert(7);
            expect(heap.max()).toBe(10);
            expect(heap.heapSize).toBe(4);
        });

        it('maintains heap property after multiple inserts', () => {
            const heap = new Heap<number>([]);
            [5, 3, 8, 1, 9, 2, 7].forEach(x => heap.insert(x));
            expect(heap.max()).toBe(9);
            expect(heap.heapSize).toBe(7);
        });
    });

    describe('max', () => {
        it('returns maximum element', () => {
            const heap = new Heap<number>([3, 1, 4, 1, 5, 9]);
            expect(heap.max()).toBe(9);
        });

        it('returns undefined for empty heap', () => {
            const heap = new Heap<number>([]);
            expect(heap.max()).toBeUndefined();
        });
    });

    describe('extractMax', () => {
        it('removes and returns maximum', () => {
            const heap = new Heap<number>([3, 1, 4, 1, 5, 9]);
            expect(heap.extractMax()).toBe(9);
            expect(heap.heapSize).toBe(5);
            expect(heap.max()).toBe(5);
        });

        it('extracts all elements in descending order', () => {
            const heap = new Heap<number>([3, 1, 4, 1, 5, 9, 2, 6]);
            const extracted: number[] = [];
            while (heap.heapSize > 0) {
                extracted.push(heap.extractMax());
            }
            expect(extracted).toEqual([9, 6, 5, 4, 3, 2, 1, 1]);
        });

        it('handles single element', () => {
            const heap = new Heap<number>([5]);
            expect(heap.extractMax()).toBe(5);
            expect(heap.heapSize).toBe(0);
        });
    });

    describe('increaseKey', () => {
        it('increases key and maintains heap property', () => {
            const heap = new Heap<number>([1, 2, 3, 4, 5]);
            heap.increaseKey(4, 10); // increase last element to 10
            expect(heap.max()).toBe(10);
        });

        it('does nothing if new key is smaller', () => {
            const heap = new Heap<number>([10, 5, 3]);
            const originalMax = heap.max();
            heap.increaseKey(0, 5); // try to decrease max
            expect(heap.max()).toBe(originalMax);
        });
    });

    describe('delete', () => {
        it('deletes element and maintains heap property', () => {
            const heap = new Heap<number>([9, 5, 6, 3, 4]);
            heap.delete(1); // delete element at index 1
            expect(heap.heapSize).toBe(4);
            // Heap property should still hold
            for (let i = 0; i < Math.floor(heap.heapSize / 2); i++) {
                const l = left(i);
                const r = right(i);
                if (l < heap.heapSize) {
                    expect(heap.items[i]).toBeGreaterThanOrEqual(heap.items[l]);
                }
                if (r < heap.heapSize) {
                    expect(heap.items[i]).toBeGreaterThanOrEqual(heap.items[r]);
                }
            }
        });

        it('deletes root element', () => {
            const heap = new Heap<number>([9, 5, 6]);
            heap.delete(0);
            expect(heap.heapSize).toBe(2);
            expect(heap.max()).toBe(6);
        });
    });

    describe('sort', () => {
        it('sorts array in ascending order', () => {
            const heap = new Heap<number>([3, 1, 4, 1, 5, 9, 2, 6]);
            const sorted = heap.sort();
            expect(sorted).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
        });

        it('sorts already sorted array', () => {
            const heap = new Heap<number>([1, 2, 3, 4, 5]);
            expect(heap.sort()).toEqual([1, 2, 3, 4, 5]);
        });

        it('sorts reverse sorted array', () => {
            const heap = new Heap<number>([5, 4, 3, 2, 1]);
            expect(heap.sort()).toEqual([1, 2, 3, 4, 5]);
        });

        it('sorts single element', () => {
            const heap = new Heap<number>([5]);
            expect(heap.sort()).toEqual([5]);
        });

        it('handles empty array', () => {
            const heap = new Heap<number>([]);
            expect(heap.sort()).toEqual([]);
        });
    });

    describe('static heapsort', () => {
        it('sorts array without modifying original reference', () => {
            const original = [3, 1, 4, 1, 5, 9, 2, 6];
            const sorted = Heap.heapsort([...original]);
            expect(sorted).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
        });

        it('sorts array with duplicates', () => {
            expect(Heap.heapsort([5, 5, 5, 1, 1])).toEqual([1, 1, 5, 5, 5]);
        });

        it('sorts array with negative numbers', () => {
            expect(Heap.heapsort([-3, 1, -4, 1, 5])).toEqual([-4, -3, 1, 1, 5]);
        });
    });
});
