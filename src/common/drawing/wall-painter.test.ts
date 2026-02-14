import 'jest-canvas-mock';
import { WallPainter, WallProps } from './wall-painter';
import { IMaterial } from '../geometry/properties';
import { Vector } from '../math/vector';

// Mock store-connector to avoid Redux dependency
jest.mock('../store/store-connector', () => ({
    connect: jest.fn((cb: Function) => {
        // Call with minimal state so WallPainter initializes
        cb({ worldConfig: {} });
        return jest.fn();
    }),
}));

// Mock textureLibrary to avoid Redux dependency
jest.mock('../textures/textureLibrary', () => ({
    textureLib: {
        lookupTexture: jest.fn(() => null),
    },
    TextureLibrary: jest.fn(),
}));

const createContext = (): CanvasRenderingContext2D => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    return canvas.getContext('2d')!;
};

const createWallProps = (overrides: Partial<WallProps> = {}): WallProps => ({
    edgeId: 'test-edge',
    height: 200,
    edgeLuminosity: 0.8,
    material: { color: [200, 100, 50, 1] },
    intersection: [50, 50],
    origin: [0, 0],
    length: 100,
    rowRange: [200, 400],
    colRange: [100, 110],
    distance: 50,
    ...overrides,
});


describe('WallPainter', () => {
    let ctx: CanvasRenderingContext2D;
    let painter: WallPainter;

    beforeEach(() => {
        ctx = createContext();
        painter = new WallPainter(ctx, 320, 600, 800);
    });

    describe('createWall', () => {
        test('creates wall props from a ray hit', () => {
            const edge = {
                id: 'e1',
                start: { id: 'v1', vector: [0, 0] as Vector },
                end: { id: 'v2', vector: [100, 0] as Vector },
                segment: [[0, 0], [100, 0]] as any,
                luminosity: 0.9,
                length: 100,
                material: { color: [255, 0, 0, 1] },
            };
            const hit = {
                polygon: {} as any,
                edge: edge as any,
                intersection: { point: [50, 0] as Vector, face: 'front' as any },
                ray: {} as any,
                distance: 20,
            };
            const wall = painter.createWall(hit, 0);
            expect(wall.height).toBeGreaterThan(0);
            expect(wall.distance).toBe(20);
            expect(wall.edgeLuminosity).toBe(0.9);
            expect(wall.rowRange[0]).toBeLessThan(wall.rowRange[1]);
        });

        test('maps ray index to column range', () => {
            const edge = {
                id: 'e1',
                start: { id: 'v1', vector: [0, 0] as Vector },
                end: { id: 'v2', vector: [100, 0] as Vector },
                segment: [[0, 0], [100, 0]] as any,
                luminosity: 0.8,
                length: 100,
                material: { color: [255, 0, 0, 1] },
            };
            const hit = {
                polygon: {} as any,
                edge: edge as any,
                intersection: { point: [50, 0] as Vector, face: 'front' as any },
                ray: {} as any,
                distance: 30,
            };
            const wall0 = painter.createWall(hit, 0);
            const wall1 = painter.createWall(hit, 1);
            // Different ray indices should produce different column ranges
            expect(wall0.colRange).not.toEqual(wall1.colRange);
        });

        test('handles null edge gracefully', () => {
            const hit = {
                polygon: {} as any,
                edge: null as any,
                intersection: null as any,
                ray: {} as any,
                distance: 100,
            };
            const wall = painter.createWall(hit, 0);
            expect(wall.material).toBeNull();
            expect(wall.edgeLuminosity).toBe(0);
        });
    });

    describe('drawWall', () => {
        test('draws wall with solid color (no texture)', () => {
            const wall = createWallProps();
            painter.drawWall([wall]);

            // Should call drawing functions
            expect(ctx.beginPath).toHaveBeenCalled();
            expect(ctx.fill).toHaveBeenCalled();
        });

        test('does not draw wall with zero height', () => {
            const wall = createWallProps({ height: 0 });
            const fillCallsBefore = (ctx.fill as jest.Mock).mock.calls.length;
            painter.drawWall([wall]);
            const fillCallsAfter = (ctx.fill as jest.Mock).mock.calls.length;
            expect(fillCallsAfter).toBe(fillCallsBefore);
        });

        test('does not draw wall with zero alpha', () => {
            const wall = createWallProps({
                material: { color: [200, 100, 50, 0] },
            });
            const fillCallsBefore = (ctx.fill as jest.Mock).mock.calls.length;
            painter.drawWall([wall]);
            const fillCallsAfter = (ctx.fill as jest.Mock).mock.calls.length;
            expect(fillCallsAfter).toBe(fillCallsBefore);
        });

        test('draws wall with multiple wallProps (wide wall)', () => {
            const wall1 = createWallProps({ colRange: [100, 110] });
            const wall2 = createWallProps({ colRange: [110, 120] });
            painter.drawWall([wall2, wall1]);
            expect(ctx.fill).toHaveBeenCalled();
        });
    });
});
