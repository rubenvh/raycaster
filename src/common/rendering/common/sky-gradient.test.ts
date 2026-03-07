import { createSkyGradient } from './sky-gradient';
import { ISkyGradient, RGBColor } from '../../store/world-config';

// Mock CanvasGradient and context
function createMockContext(skyHeight: number) {
    const stops: { offset: number, color: string }[] = [];
    const mockGradient = {
        addColorStop: (offset: number, color: string) => {
            stops.push({ offset, color });
        },
    } as unknown as CanvasGradient;

    const gradientArgs: { x0: number, y0: number, x1: number, y1: number }[] = [];
    const ctx = {
        createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
            gradientArgs.push({ x0, y0, x1, y1 });
            return mockGradient;
        },
    } as unknown as CanvasRenderingContext2D;

    return { ctx, stops, gradientArgs };
}

describe('createSkyGradient', () => {
    const topColor: RGBColor = [100, 150, 200];
    const bottomColor: RGBColor = [50, 80, 120];

    test('defaults: position=0.5, width=1.0 produces a simple two-stop gradient', () => {
        const { ctx, stops, gradientArgs } = createMockContext(300);
        const gradient: ISkyGradient = { topColor, bottomColor };

        createSkyGradient(ctx, gradient, 800, 300);

        // Gradient spans full sky height
        expect(gradientArgs).toHaveLength(1);
        expect(gradientArgs[0]).toEqual({ x0: 0, y0: 0, x1: 0, y1: 300 });

        // With position=0.5, width=1.0: start=0, end=1
        // So we get just two stops: 0 -> top, 1 -> bottom
        expect(stops).toHaveLength(2);
        expect(stops[0]).toEqual({ offset: 0, color: `rgb(${topColor.join(',')})` });
        expect(stops[1]).toEqual({ offset: 1, color: `rgb(${bottomColor.join(',')})` });
    });

    test('position=0.5, width=0.5 produces four stops with transition in the middle', () => {
        const { ctx, stops } = createMockContext(400);
        const gradient: ISkyGradient = {
            topColor, bottomColor,
            crossoverPosition: 0.5,
            crossoverWidth: 0.5,
        };

        createSkyGradient(ctx, gradient, 800, 400);

        // start = 0.5 - 0.25 = 0.25, end = 0.5 + 0.25 = 0.75
        expect(stops).toHaveLength(4);
        expect(stops[0]).toEqual({ offset: 0, color: `rgb(${topColor.join(',')})` });
        expect(stops[1]).toEqual({ offset: 0.25, color: `rgb(${topColor.join(',')})` });
        expect(stops[2]).toEqual({ offset: 0.75, color: `rgb(${bottomColor.join(',')})` });
        expect(stops[3]).toEqual({ offset: 1, color: `rgb(${bottomColor.join(',')})` });
    });

    test('width=0 produces a hard line at the crossover position', () => {
        const { ctx, stops } = createMockContext(200);
        const gradient: ISkyGradient = {
            topColor, bottomColor,
            crossoverPosition: 0.3,
            crossoverWidth: 0,
        };

        createSkyGradient(ctx, gradient, 800, 200);

        // start = 0.3, end = 0.3 — both are between 0 and 1
        expect(stops).toHaveLength(4);
        expect(stops[0]).toEqual({ offset: 0, color: `rgb(${topColor.join(',')})` });
        expect(stops[1]).toEqual({ offset: 0.3, color: `rgb(${topColor.join(',')})` });
        expect(stops[2]).toEqual({ offset: 0.3, color: `rgb(${bottomColor.join(',')})` });
        expect(stops[3]).toEqual({ offset: 1, color: `rgb(${bottomColor.join(',')})` });
    });

    test('position=0 puts the transition at the top', () => {
        const { ctx, stops } = createMockContext(200);
        const gradient: ISkyGradient = {
            topColor, bottomColor,
            crossoverPosition: 0,
            crossoverWidth: 0.4,
        };

        createSkyGradient(ctx, gradient, 800, 200);

        // start = max(0, 0 - 0.2) = 0, end = min(1, 0 + 0.2) = 0.2
        // transitionStart = 0 (not > 0), so no extra stop for topColor after 0
        // transitionEnd = 0.2 (< 1), so extra stop for bottomColor at 0.2
        expect(stops).toHaveLength(3);
        expect(stops[0]).toEqual({ offset: 0, color: `rgb(${topColor.join(',')})` });
        expect(stops[1]).toEqual({ offset: 0.2, color: `rgb(${bottomColor.join(',')})` });
        expect(stops[2]).toEqual({ offset: 1, color: `rgb(${bottomColor.join(',')})` });
    });

    test('position=1 puts the transition at the bottom', () => {
        const { ctx, stops } = createMockContext(200);
        const gradient: ISkyGradient = {
            topColor, bottomColor,
            crossoverPosition: 1,
            crossoverWidth: 0.6,
        };

        createSkyGradient(ctx, gradient, 800, 200);

        // start = max(0, 1 - 0.3) = 0.7, end = min(1, 1 + 0.3) = 1
        // transitionStart = 0.7 (> 0), so extra stop for topColor at 0.7
        // transitionEnd = 1 (not < 1), so no extra stop for bottomColor before 1
        expect(stops).toHaveLength(3);
        expect(stops[0]).toEqual({ offset: 0, color: `rgb(${topColor.join(',')})` });
        expect(stops[1]).toEqual({ offset: 0.7, color: `rgb(${topColor.join(',')})` });
        expect(stops[2]).toEqual({ offset: 1, color: `rgb(${bottomColor.join(',')})` });
    });

    test('returns a CanvasGradient object', () => {
        const { ctx } = createMockContext(200);
        const gradient: ISkyGradient = { topColor, bottomColor };
        const result = createSkyGradient(ctx, gradient, 800, 200);
        expect(result).toBeDefined();
        // It should have addColorStop method (our mock)
        expect(typeof (result as any).addColorStop).toBe('function');
    });
});
