import { PriorityQueue } from './priority-queue'
import { swap } from './utils';
export class Heap<T> implements PriorityQueue<T> {
  heapSize: number;
  items: T[];
  private comparer: (a: T, b: T) => number;

  constructor(items: T[], comparer?: (a: T, b: T) => number) {
    this.heapSize = items.length;
    this.comparer = comparer || ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    this.items = this.buildHeap(items);
  }

  insert(element: T): void {
    let i = this.heapSize++;
    this.items[i] = element;
    this.heapFilterUp(i);
  }

  max = (): T => this.items[0];

  extractMax(): T {
    const result = this.max();
    if (result != null) {
      const last = this.extractLast();
      if (this.heapSize > 0) {
        this.items[0] = last;
        this.heapify(this.items, 0);
      }
    }
    return result;
  }

  increaseKey(i: number, k: T) {
    const needIncrease = !this.items[i] || this.comparer(this.items[i], k) < 0;
    if (needIncrease) {
      this.items[i] = k;
      this.heapFilterUp(i);
    }
  }

  delete(i: number) {
    const last = this.extractLast();
    if (this.heapSize > 0) {
      this.items[i] = last;
      if (this.comparer(this.items[i], this.items[parentNode(i)]) >= 1) {
        this.heapFilterUp(i);
      } else {
        this.heapify(this.items, i);
      }
    }
  }

  buildHeap(items: T[]): T[] {
    return items
      .filter((_, i) => i <= parentNode(this.heapSize))
      .reduceRight((a, _y, i) => this.heapify(a, i), items);
  }

  heapFilterUp(i: number) {
    while (this.comparer(this.items[i], this.items[parentNode(i)]) >= 1) {
      swap(this.items, i, parentNode(i));
      i = parentNode(i);
    }
  }

  heapify(a: T[], index: number): T[] {
    const l = left(index);
    const r = right(index);
    let largest = index;
    if (l < this.heapSize && this.comparer(a[l], a[largest]) >= 1) {
      largest = l;
    }
    if (r < this.heapSize && this.comparer(a[r], a[largest]) >= 1) {
      largest = r;
    }
    if (largest !== index) {
      return this.heapify(swap(a, index, largest), largest);
    }
    return a;
  }

  extractLast(): T {
    const result = this.items[--this.heapSize];
    this.items.length = this.heapSize;
    return result;
  }

  static heapsort<T>(items: T[]): T[] {
    const heap = new Heap<T>(items);
    while (heap.heapSize > 1) {
      swap(heap.items, 0, heap.heapSize - 1);
      heap.heapSize--;
      heap.heapify(heap.items, 0);
    }
    return heap.items;
  }
}

export const left = (i: number) => (i + 1) * 2 - 1;
export const right = (i: number) => (i + 1) * 2;
export const parentNode = (i: number) =>  Math.max(0, Math.floor((i + 1) / 2) - 1);