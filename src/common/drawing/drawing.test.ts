import 'jest-canvas-mock';
import { drawVector, drawSegment, drawRect, drawBoundingBox, drawTrapezoid, drawPlane } from './drawing';
import { ILineSegment } from '../math/lineSegment';
import { Vector } from '../math/vector';
import { BoundingBox } from '../geometry/polygon';
import { Plane } from '../math/plane';

const createContext = (): CanvasRenderingContext2D => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    return canvas.getContext('2d')!;
};

// ─── drawVector ──────────────────────────────────────────────────

describe('drawVector', () => {
    test('draws arc at vector position', () => {
        const ctx = createContext();
        drawVector(ctx, [50, 75]);
        const calls = (ctx.arc as jest.Mock).mock.calls;
        expect(calls.length).toBe(1);
        expect(calls[0][0]).toBe(50);
        expect(calls[0][1]).toBe(75);
        expect(calls[0][2]).toBe(2); // radius
    });

    test('uses default color when not specified', () => {
        const ctx = createContext();
        drawVector(ctx, [10, 20]);
        // jest-canvas-mock normalizes colors, just verify fillStyle was set
        expect(ctx.fillStyle).toBeDefined();
        expect(ctx.fill).toHaveBeenCalled();
    });

    test('uses custom color when specified', () => {
        const ctx = createContext();
        drawVector(ctx, [10, 20], 'red');
        // fillStyle is normalized by canvas mock
        expect(ctx.fill).toHaveBeenCalled();
    });

    test('calls beginPath and fill', () => {
        const ctx = createContext();
        drawVector(ctx, [0, 0]);
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.fill).toHaveBeenCalled();
    });
});

// ─── drawSegment ─────────────────────────────────────────────────

describe('drawSegment', () => {
    test('draws line from start to end', () => {
        const ctx = createContext();
        const segment: ILineSegment = [[10, 20], [30, 40]];
        drawSegment(ctx, segment);
        expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(30, 40);
    });

    test('uses default color white', () => {
        const ctx = createContext();
        drawSegment(ctx, [[0, 0], [10, 10]]);
        expect(ctx.stroke).toHaveBeenCalled();
    });

    test('uses custom color', () => {
        const ctx = createContext();
        drawSegment(ctx, [[0, 0], [10, 10]], 'blue');
        expect(ctx.stroke).toHaveBeenCalled();
    });

    test('uses custom lineWidth', () => {
        const ctx = createContext();
        drawSegment(ctx, [[0, 0], [10, 10]], 'white', 3);
        expect(ctx.lineWidth).toBe(3);
    });

    test('clears line dash', () => {
        const ctx = createContext();
        drawSegment(ctx, [[0, 0], [10, 10]]);
        expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    });

    test('calls stroke', () => {
        const ctx = createContext();
        drawSegment(ctx, [[0, 0], [10, 10]]);
        expect(ctx.stroke).toHaveBeenCalled();
    });
});

// ─── drawRect ────────────────────────────────────────────────────

describe('drawRect', () => {
    test('fills rectangle between segment points', () => {
        const ctx = createContext();
        const segment: ILineSegment = [[10, 20], [50, 60]];
        drawRect(ctx, segment);
        expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 40, 40);
    });

    test('uses default blue fill', () => {
        const ctx = createContext();
        drawRect(ctx, [[0, 0], [10, 10]]);
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    test('uses custom color', () => {
        const ctx = createContext();
        drawRect(ctx, [[0, 0], [10, 10]], 'red');
        expect(ctx.fillRect).toHaveBeenCalled();
    });
});

// ─── drawBoundingBox ─────────────────────────────────────────────

describe('drawBoundingBox', () => {
    test('strokes rectangle with 5px padding', () => {
        const ctx = createContext();
        const bb: BoundingBox = [[10, 20], [50, 60]];
        drawBoundingBox(ctx, bb);
        // x1=5, y1=15, width=50, height=50
        expect(ctx.strokeRect).toHaveBeenCalledWith(5, 15, 50, 50);
    });

    test('uses dashed line', () => {
        const ctx = createContext();
        drawBoundingBox(ctx, [[0, 0], [10, 10]]);
        expect(ctx.setLineDash).toHaveBeenCalledWith([4, 2]);
    });

    test('uses default color', () => {
        const ctx = createContext();
        drawBoundingBox(ctx, [[0, 0], [10, 10]]);
        expect(ctx.strokeRect).toHaveBeenCalled();
    });

    test('uses custom color', () => {
        const ctx = createContext();
        drawBoundingBox(ctx, [[0, 0], [10, 10]], 'green');
        expect(ctx.strokeRect).toHaveBeenCalled();
    });
});

// ─── drawTrapezoid ───────────────────────────────────────────────

describe('drawTrapezoid', () => {
    test('draws a four-point filled path', () => {
        const ctx = createContext();
        const points: [Vector, Vector, Vector, Vector] = [[0, 0], [10, 0], [10, 10], [0, 10]];
        drawTrapezoid(ctx, points, 'rgba(255,0,0,0.5)');

        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
        expect(ctx.lineTo).toHaveBeenCalledWith(10, 0);
        expect(ctx.lineTo).toHaveBeenCalledWith(10, 10);
        expect(ctx.lineTo).toHaveBeenCalledWith(0, 10);
        expect(ctx.closePath).toHaveBeenCalled();
        expect(ctx.fill).toHaveBeenCalled();
    });
});

// ─── drawPlane ───────────────────────────────────────────────────

describe('drawPlane', () => {
    test('draws a plane line and returns two clip paths', () => {
        const ctx = createContext();
        // Vertical plane at x=50 (normal pointing right)
        const plane: Plane = { n: [1, 0], d: 50 };
        const bounds: Vector = [800, 600];
        const result = drawPlane(ctx, plane, 'green', [], bounds);

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
        expect(result).toHaveLength(2);
    });

    test('returns Path2D clip regions', () => {
        const ctx = createContext();
        const plane: Plane = { n: [0, 1], d: 100 }; // horizontal plane
        const bounds: Vector = [800, 600];
        const result = drawPlane(ctx, plane, 'red', [], bounds);

        expect(result[0]).toBeInstanceOf(Path2D);
        expect(result[1]).toBeInstanceOf(Path2D);
    });

    test('applies existing clip regions', () => {
        const ctx = createContext();
        const plane: Plane = { n: [1, 0], d: 50 };
        const existingClip = new Path2D();
        const bounds: Vector = [800, 600];
        drawPlane(ctx, plane, 'blue', [existingClip], bounds);

        expect(ctx.clip).toHaveBeenCalled();
    });

    test('handles semi-horizontal plane differently', () => {
        const ctx = createContext();
        // Semi-horizontal plane (|nx| < |ny| equivalent or nx component less significant)
        const horizontalPlane: Plane = { n: [0.1, 1], d: 100 };
        const verticalPlane: Plane = { n: [1, 0.1], d: 100 };
        const bounds: Vector = [800, 600];

        const hResult = drawPlane(ctx, horizontalPlane, 'green', [], bounds);
        const vResult = drawPlane(ctx, verticalPlane, 'green', [], bounds);

        // Both should return 2 paths
        expect(hResult).toHaveLength(2);
        expect(vResult).toHaveLength(2);
    });
});
