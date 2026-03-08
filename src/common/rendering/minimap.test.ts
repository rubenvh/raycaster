import 'jest-canvas-mock';
import { MiniMap } from './minimap';
import { makeCamera, ICamera } from '../camera';
import { createGeometry } from '../geometry/geometry';
import { Vector } from '../math/vector';

// Capture the connect callback so we can push state updates to MiniMap
let connectCallback: Function;
jest.mock('../store/store-connector', () => ({
    connect: jest.fn((cb: Function) => {
        connectCallback = cb;
        // Call with minimal initial state
        cb({
            player: { camera: makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] }) },
            walls: { geometry: { polygons: [], edgeCount: 0, bounds: [0, 0] } }
        });
        return jest.fn();
    }),
}));

const createContext = (): CanvasRenderingContext2D => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    return canvas.getContext('2d')!;
};

describe('MiniMap', () => {
    let minimap: MiniMap;
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
        minimap = new MiniMap();
        ctx = createContext();
    });

    afterEach(() => {
        minimap.dispose();
    });

    describe('visibility toggle', () => {
        it('should start hidden', () => {
            expect(minimap.isVisible()).toBe(false);
        });

        it('should toggle to visible', () => {
            minimap.toggle();
            expect(minimap.isVisible()).toBe(true);
        });

        it('should toggle back to hidden', () => {
            minimap.toggle();
            minimap.toggle();
            expect(minimap.isVisible()).toBe(false);
        });
    });

    describe('draw', () => {
        it('should not draw when hidden', () => {
            minimap.draw(ctx, 640, 480);
            // When hidden, save/restore should NOT be called
            // (jest-canvas-mock tracks calls)
            const events = (ctx as any).__getEvents();
            expect(events.length).toBe(0);
        });

        it('should draw when visible', () => {
            minimap.toggle();
            minimap.draw(ctx, 640, 480);
            // Should have drawing operations (save, clip, fillRect for background, etc.)
            const events = (ctx as any).__getEvents();
            expect(events.length).toBeGreaterThan(0);
        });

        it('should draw background rectangle', () => {
            minimap.toggle();
            minimap.draw(ctx, 640, 480);
            const events = (ctx as any).__getEvents();
            // Look for fillRect call (background)
            const fillRects = events.filter((e: any) => e.type === 'fillRect');
            expect(fillRects.length).toBeGreaterThanOrEqual(1);
        });

        it('should draw camera position dot', () => {
            minimap.toggle();
            minimap.draw(ctx, 640, 480);
            const events = (ctx as any).__getEvents();
            // Look for arc calls (camera dot + vertices)
            const arcs = events.filter((e: any) => e.type === 'arc');
            // At minimum: camera position dot
            expect(arcs.length).toBeGreaterThanOrEqual(1);
        });

        it('should draw direction indicator line', () => {
            minimap.toggle();
            minimap.draw(ctx, 640, 480);
            const events = (ctx as any).__getEvents();
            const strokes = events.filter((e: any) => e.type === 'stroke');
            // At least: direction line + arrowhead + border
            expect(strokes.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('with geometry', () => {
        it('should draw edges from nearby geometry', () => {
            // Create geometry near the camera at [50, 50]
            const geometry = createGeometry([
                [[20, 20], [80, 20], [80, 80], [20, 80]]
            ]);

            // Push state update with geometry
            connectCallback({
                player: { camera: makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] }) },
                walls: { geometry }
            });

            minimap.toggle();
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            // Should have edge lines (moveTo/lineTo pairs for 4 edges of rectangle)
            const lineToEvents = events.filter((e: any) => e.type === 'lineTo');
            // 4 edges + direction line + arrowhead lines = at least 4
            expect(lineToEvents.length).toBeGreaterThanOrEqual(4);
        });

        it('should skip edges with null material (BSP split edges)', () => {
            // Create geometry, then manually null out materials
            const geometry = createGeometry([
                [[20, 20], [80, 20], [80, 80], [20, 80]]
            ]);
            // Null out all materials to simulate split edges
            geometry.polygons.forEach(p =>
                p.edges.forEach(e => (e as any).material = null)
            );

            connectCallback({
                player: { camera: makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] }) },
                walls: { geometry }
            });

            minimap.toggle();
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            // Should still draw camera + direction, but no edge lines
            // Count moveTo -> lineTo pairs that use edge colors
            // The only lineTo calls should be from the direction indicator
            const lineToEvents = events.filter((e: any) => e.type === 'lineTo');
            // Direction line (1) + arrowhead (2) = 3
            expect(lineToEvents.length).toBe(3);
        });

        it('should skip edges far from camera', () => {
            // Create geometry far from camera at [50, 50]
            const geometry = createGeometry([
                [[900, 900], [1000, 900], [1000, 1000], [900, 1000]]
            ]);

            connectCallback({
                player: { camera: makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] }) },
                walls: { geometry }
            });

            minimap.toggle();
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            const lineToEvents = events.filter((e: any) => e.type === 'lineTo');
            // Only direction indicator lines (no edge lines since geometry is too far)
            expect(lineToEvents.length).toBe(3);
        });
    });

    describe('positioning', () => {
        it('should draw in bottom-right corner', () => {
            minimap.toggle();
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            // The clip rect should be in the bottom-right area
            const rectEvents = events.filter((e: any) => e.type === 'rect');
            expect(rectEvents.length).toBeGreaterThanOrEqual(1);
            // Minimap is 200px, margin 10px: x = 640-200-10 = 430, y = 480-200-10 = 270
            const clipRect = rectEvents[0];
            expect(clipRect.props.x).toBe(430);
            expect(clipRect.props.y).toBe(270);
            expect(clipRect.props.width).toBe(200);
            expect(clipRect.props.height).toBe(200);
        });
    });

    describe('path overlay', () => {
        it('should not draw path when no path is set', () => {
            minimap.toggle();
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            // Count arcs: should only be the camera dot (1 arc)
            const arcs = events.filter((e: any) => e.type === 'arc');
            expect(arcs.length).toBe(1); // Just camera dot
        });

        it('should not draw path when path has fewer than 2 waypoints', () => {
            minimap.toggle();
            minimap.setPath([[50, 50]], 0);
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            const arcs = events.filter((e: any) => e.type === 'arc');
            // Just camera dot — no waypoint arcs
            expect(arcs.length).toBe(1);
        });

        it('should draw path line segments when path has waypoints', () => {
            minimap.toggle();
            minimap.setPath([[30, 30], [50, 50], [70, 30]], 0);
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            // Should have lineTo events for path segments + direction indicator
            const lineToEvents = events.filter((e: any) => e.type === 'lineTo');
            // Path: 2 upcoming segments = 2 lineTo (from 0→1, 1→2)
            // Direction indicator: 1 line + 2 arrowhead lines = 3 lineTo
            // Total: at least 5
            expect(lineToEvents.length).toBeGreaterThanOrEqual(5);
        });

        it('should draw waypoint dots for each waypoint', () => {
            minimap.toggle();
            minimap.setPath([[30, 30], [50, 50], [70, 30]], 1);
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            const arcs = events.filter((e: any) => e.type === 'arc');
            // 3 waypoint dots + 1 camera dot = 4
            expect(arcs.length).toBe(4);
        });

        it('should draw visited segments faintly and upcoming segments brightly', () => {
            minimap.toggle();
            // 4 waypoints, currently heading to index 2 (indices 0-1 are visited)
            minimap.setPath([[30, 30], [40, 40], [60, 60], [70, 30]], 2);
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            // Should have at least 2 separate stroke calls for path
            // (one for visited segments, one for upcoming)
            const strokes = events.filter((e: any) => e.type === 'stroke');
            // Visited path stroke + upcoming path stroke + direction stroke + arrowhead strokes + border
            expect(strokes.length).toBeGreaterThanOrEqual(4);
        });

        it('should clear path when set to empty', () => {
            minimap.toggle();
            minimap.setPath([[30, 30], [50, 50], [70, 30]], 0);

            // Draw with path
            minimap.draw(ctx, 640, 480);
            const events1 = (ctx as any).__getEvents();
            const arcs1 = events1.filter((e: any) => e.type === 'arc');

            // Now clear path and draw again with a fresh context
            minimap.setPath([], 0);
            const ctx2 = createContext();
            minimap.draw(ctx2, 640, 480);
            const events2 = (ctx2 as any).__getEvents();
            const arcs2 = events2.filter((e: any) => e.type === 'arc');

            // With path cleared, should only have camera dot
            expect(arcs1.length).toBeGreaterThan(arcs2.length);
            expect(arcs2.length).toBe(1); // Just camera dot
        });

        it('should not draw path when minimap is hidden', () => {
            // Don't toggle visible
            minimap.setPath([[30, 30], [50, 50], [70, 30]], 0);
            minimap.draw(ctx, 640, 480);

            const events = (ctx as any).__getEvents();
            expect(events.length).toBe(0);
        });
    });
});
