import 'jest-canvas-mock';
import { ScrollBar } from './scrollBar';

describe('ScrollBar', () => {
    describe('construction', () => {
        test('starts at position 0', () => {
            const sb = new ScrollBar(true, 800);
            expect(sb.position).toBe(0);
        });

        test('horizontal and vertical start at 0', () => {
            const h = new ScrollBar(true, 800, 790);
            const v = new ScrollBar(false, 600, 590);
            expect(h.position).toBe(0);
            expect(v.position).toBe(0);
        });
    });

    describe('scroll', () => {
        test('scrolls forward by positive value', () => {
            const sb = new ScrollBar(true, 800);
            sb.scroll(100);
            expect(sb.position).toBe(100);
        });

        test('scrolls further with multiple calls', () => {
            const sb = new ScrollBar(true, 800);
            sb.scroll(50);
            sb.scroll(75);
            expect(sb.position).toBe(125);
        });

        test('does not scroll below 0', () => {
            const sb = new ScrollBar(true, 800);
            sb.scroll(-100);
            expect(sb.position).toBe(0);
        });

        test('scrolls back but not past 0', () => {
            const sb = new ScrollBar(true, 800);
            sb.scroll(50);
            sb.scroll(-200);
            expect(sb.position).toBe(0);
        });
    });

    describe('scrollTo', () => {
        test('sets position directly', () => {
            const sb = new ScrollBar(true, 800);
            sb.scrollTo(150);
            expect(sb.position).toBe(150);
        });

        test('overwrites previous position', () => {
            const sb = new ScrollBar(true, 800);
            sb.scroll(100);
            sb.scrollTo(50);
            expect(sb.position).toBe(50);
        });
    });

    describe('reset', () => {
        test('resets position to 0', () => {
            const sb = new ScrollBar(true, 800);
            sb.scroll(300);
            sb.reset();
            expect(sb.position).toBe(0);
        });
    });

    describe('setBoundary', () => {
        test('sets boundary for scrollbar calculation', () => {
            const sb = new ScrollBar(true, 800);
            sb.setBoundary(2000);
            // Scrollbar should still function after setting boundary
            sb.scroll(100);
            expect(sb.position).toBe(100);
        });
    });

    describe('resize', () => {
        test('updates view and size', () => {
            const sb = new ScrollBar(true, 800, 790);
            sb.resize(400, 390);
            // Should still function correctly
            sb.scroll(50);
            expect(sb.position).toBe(50);
        });

        test('accepts scale parameter', () => {
            const sb = new ScrollBar(true, 800, 790);
            sb.resize(400, 390, 2);
            expect(sb.scale).toBe(2);
        });
    });

    describe('draw', () => {
        test('draws horizontal scrollbar', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d')!;

            const sb = new ScrollBar(true, 800, 790);
            sb.setBoundary(2000); // make scrollbar visible (content larger than view)
            sb.draw(ctx, 590, 1);

            expect(ctx.fillRect).toHaveBeenCalled();
        });

        test('draws vertical scrollbar', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d')!;

            const sb = new ScrollBar(false, 600, 590);
            sb.setBoundary(2000);
            sb.draw(ctx, 790, 1);

            expect(ctx.fillRect).toHaveBeenCalled();
        });

        test('does not draw when content fits in view', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d')!;

            const sb = new ScrollBar(true, 800, 790);
            sb.resize(800, 790, 1);
            sb.setBoundary(800); // content same size as view
            sb.draw(ctx, 590, 1);

            // barSize should equal size, so draw should be skipped
            expect(ctx.fillRect).not.toHaveBeenCalled();
        });
    });
});
