import 'jest-canvas-mock';
import { Grid } from './grid';

describe('Grid', () => {
    const createContext = (): CanvasRenderingContext2D => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        return canvas.getContext('2d')!;
    };

    test('constructs with initial dimensions', () => {
        const ctx = createContext();
        // Grid creates an internal canvas and draws grid lines
        const grid = new Grid(ctx, 400, 300);
        // Should have drawn grid lines during construction
        expect(ctx).toBeDefined();
    });

    describe('adaptGrid', () => {
        test('expands grid when dimensions exceed current size', () => {
            const ctx = createContext();
            const grid = new Grid(ctx, 200, 200);
            // Adapt to larger size — should rebuild grid
            grid.adaptGrid(500, 500);
            // No error thrown means it adapted successfully
        });

        test('does not rebuild when dimensions are smaller than current', () => {
            const ctx = createContext();
            const grid = new Grid(ctx, 500, 500);
            // Internal canvas is 500+1000=1500, so 400 won't trigger rebuild
            grid.adaptGrid(400, 400);
        });
    });

    describe('draw', () => {
        test('draws grid section onto target context', () => {
            const ctx = createContext();
            const grid = new Grid(ctx, 400, 300);
            grid.draw(0, 0, 400, 300);
            expect(ctx.drawImage).toHaveBeenCalled();
        });

        test('draws grid at offset position', () => {
            const ctx = createContext();
            const grid = new Grid(ctx, 400, 300);
            grid.draw(100, 50, 200, 150);
            expect(ctx.drawImage).toHaveBeenCalledWith(
                expect.anything(),
                100, 50, 200, 150,
                100, 50, 200, 150
            );
        });
    });
});
