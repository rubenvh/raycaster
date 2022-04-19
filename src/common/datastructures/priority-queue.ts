export interface PriorityQueue<T> {
    insert(element: T): void;
    max(): T;
    extractMax(): T;
  }