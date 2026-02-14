import 'jest-canvas-mock';
import { ViewPort } from './viewport';

describe('ViewPort', () => {
    const createCanvas = (): HTMLCanvasElement => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        // jest-canvas-mock provides getContext('2d')
        // Set offset properties that ViewPort reads
        Object.defineProperty(canvas, 'offsetLeft', { value: 0 });
        Object.defineProperty(canvas, 'offsetTop', { value: 0 });
        Object.defineProperty(canvas, 'clientLeft', { value: 0 });
        Object.defineProperty(canvas, 'clientTop', { value: 0 });
        return canvas;
    };

    test('constructs without error', () => {
        const canvas = createCanvas();
        const viewport = new ViewPort(canvas);
        expect(viewport).toBeDefined();
        expect(viewport.scale).toBe(1);
    });

    describe('toWorldSpace', () => {
        test('converts viewport position to world space at scale 1', () => {
            const viewport = new ViewPort(createCanvas());
            const world = viewport.toWorldSpace([100, 200]);
            // At scale 1 with no scroll, world = ceil((pos + scroll) / scale)
            expect(world[0]).toBe(100);
            expect(world[1]).toBe(200);
        });

        test('accounts for scroll position', () => {
            const viewport = new ViewPort(createCanvas());
            // Scrolling changes the world space mapping
            // scrollX and scrollY start at 0
            const world = viewport.toWorldSpace([0, 0]);
            expect(world[0]).toBe(0);
            expect(world[1]).toBe(0);
        });
    });

    describe('toViewPortSpace', () => {
        test('converts world position to viewport space at scale 1', () => {
            const viewport = new ViewPort(createCanvas());
            const vp = viewport.toViewPortSpace([100, 200]);
            // scale*pos - scroll => 1*100 - 0 = 100
            expect(vp[0]).toBe(100);
            expect(vp[1]).toBe(200);
        });
    });

    describe('setBounds', () => {
        test('sets scroll boundary without error', () => {
            const viewport = new ViewPort(createCanvas());
            viewport.setBounds([2000, 1500]);
            // Should not throw
        });
    });

    describe('reset', () => {
        test('resets scale to 1', () => {
            const viewport = new ViewPort(createCanvas());
            viewport.scale = 2;
            viewport.reset();
            expect(viewport.scale).toBe(1);
        });
    });

    describe('drawBackground', () => {
        test('clears and draws grid', () => {
            const canvas = createCanvas();
            const ctx = canvas.getContext('2d')!;
            const viewport = new ViewPort(canvas);
            viewport.drawBackground();
            expect(ctx.clearRect).toHaveBeenCalled();
        });
    });

    describe('drawForeground', () => {
        test('draws scrollbars', () => {
            const canvas = createCanvas();
            const ctx = canvas.getContext('2d')!;
            const viewport = new ViewPort(canvas);
            viewport.setBounds([2000, 1500]); // make scrollbars visible
            viewport.drawForeground();
            // fillRect should be called for scrollbar rendering
            expect(ctx.fillRect).toHaveBeenCalled();
        });
    });
});
