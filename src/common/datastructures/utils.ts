export function swap(a: any[], x: number, y: number): any[] {
    const temp = a[x];
    a[x] = a[y];
    a[y] = temp;
    return a;
  }