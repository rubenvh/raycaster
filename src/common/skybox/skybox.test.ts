import { ISkyboxRegion } from './model';
import { Skybox } from './skybox';

// jsdom's canvas getContext('2d') returns null, and Image.onload doesn't fire.
// We mock getContext to return a stub, and accept that the skybox image never
// loads (we don't need it for drawTiled tests — only the target context matters).

function createMockTargetContext() {
    const calls: { name: string, args: any[] }[] = [];
    return {
        calls,
        context: {
            drawImage: (...args: any[]) => { calls.push({ name: 'drawImage', args }); },
        } as unknown as CanvasRenderingContext2D,
    };
}

function createTestSkybox(width: number, height: number): Skybox {
    // Mock getContext so the constructor doesn't fail
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => ({
        drawImage: () => {},
    })) as any;

    const source = { id: 'test.png', data: 'AA==', mimeType: 'image/png', width, height };
    const skybox = new Skybox(source);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    return skybox;
}

describe('Skybox.drawTiled', () => {
    describe('without vertical tiling (stretch mode)', () => {
        test('draws a single strip when srcX is 0 and region fits destination', () => {
            const skybox = createTestSkybox(200, 100);
            const { context, calls } = createMockTargetContext();

            skybox.drawTiled(context, 0, 0, 200, 150, 0);

            // Should be one drawImage call: full width, stretched vertically
            expect(calls).toHaveLength(1);
            const a = calls[0].args;
            // src rect: x=0, y=0, w=200, h=100
            expect(a[1]).toBe(0);   // srcX
            expect(a[2]).toBe(0);   // srcY
            expect(a[3]).toBe(200); // srcW
            expect(a[4]).toBe(100); // srcH
            // dest rect
            expect(a[5]).toBe(0);   // destX
            expect(a[6]).toBe(0);   // destY
            expect(a[7]).toBe(200); // destW
            expect(a[8]).toBe(150); // destH
        });

        test('wraps horizontally when srcX exceeds region width', () => {
            const skybox = createTestSkybox(200, 100);
            const { context, calls } = createMockTargetContext();

            skybox.drawTiled(context, 0, 0, 200, 150, 150);

            // srcX=150 in a 200-wide region: first strip is 50px, second is 150px
            expect(calls).toHaveLength(2);
            // First strip: from x=150, width=50
            expect(calls[0].args[1]).toBe(150);  // srcX
            expect(calls[0].args[3]).toBe(50);   // srcW
            expect(calls[0].args[5]).toBe(0);    // destX
            expect(calls[0].args[7]).toBe(50);   // destW
            // Second strip: wraps from x=0, width=150
            expect(calls[1].args[1]).toBe(0);    // srcX
            expect(calls[1].args[3]).toBe(150);  // srcW
            expect(calls[1].args[5]).toBe(50);   // destX
            expect(calls[1].args[7]).toBe(150);  // destW
        });

        test('uses provided region instead of full image', () => {
            const skybox = createTestSkybox(400, 200);
            const { context, calls } = createMockTargetContext();
            const region: ISkyboxRegion = { x: 50, y: 25, width: 100, height: 50 };

            skybox.drawTiled(context, 0, 0, 100, 150, 0, region);

            expect(calls).toHaveLength(1);
            expect(calls[0].args[1]).toBe(50);   // srcX = region.x + 0
            expect(calls[0].args[2]).toBe(25);   // srcY = region.y
            expect(calls[0].args[3]).toBe(100);  // srcW = region.width
            expect(calls[0].args[4]).toBe(50);   // srcH = region.height
        });
    });

    describe('with vertical tiling', () => {
        test('tiles vertically preserving aspect ratio', () => {
            // Region is 200x100, dest is 200x300
            // Tile height = destWidth * (regionHeight / regionWidth) = 200 * (100/200) = 100
            // So 3 tiles fit exactly into destHeight=300
            const skybox = createTestSkybox(200, 100);
            const { context, calls } = createMockTargetContext();

            skybox.drawTiled(context, 0, 0, 200, 300, 0, undefined, true);

            // 3 full rows, each gets 1 drawImage call (srcX=0, so no wrap)
            expect(calls).toHaveLength(3);
            for (let i = 0; i < 3; i++) {
                expect(calls[i].args[1]).toBe(0);          // srcX
                expect(calls[i].args[2]).toBe(0);          // srcY
                expect(calls[i].args[3]).toBe(200);        // srcW
                expect(calls[i].args[4]).toBe(100);        // srcH
                expect(calls[i].args[5]).toBe(0);          // destX
                expect(calls[i].args[6]).toBe(i * 100);    // destY
                expect(calls[i].args[7]).toBe(200);        // destW
                expect(calls[i].args[8]).toBe(100);        // destH
            }
        });

        test('handles partial last row', () => {
            // Region 200x100, dest 200x250
            // Tile height = 100, so 2 full tiles (200px) + 50px partial
            const skybox = createTestSkybox(200, 100);
            const { context, calls } = createMockTargetContext();

            skybox.drawTiled(context, 0, 0, 200, 250, 0, undefined, true);

            expect(calls).toHaveLength(3);
            // First two full tiles
            expect(calls[0].args[6]).toBe(0);     // destY=0
            expect(calls[0].args[8]).toBe(100);   // destHeight=100
            expect(calls[1].args[6]).toBe(100);   // destY=100
            expect(calls[1].args[8]).toBe(100);   // destHeight=100
            // Partial third tile
            expect(calls[2].args[6]).toBe(200);   // destY=200
            expect(calls[2].args[8]).toBe(50);    // destHeight=50
            expect(calls[2].args[4]).toBe(50);    // srcH=50 (partial)
        });

        test('combines horizontal wrapping with vertical tiling', () => {
            // Region 200x100, dest 200x100, srcX=150
            // Tile height = 100, so 1 row
            // Horizontal: first strip 50px, second strip 150px
            const skybox = createTestSkybox(200, 100);
            const { context, calls } = createMockTargetContext();

            skybox.drawTiled(context, 0, 0, 200, 100, 150, undefined, true);

            // 1 row, 2 horizontal strips
            expect(calls).toHaveLength(2);
            // First strip
            expect(calls[0].args[1]).toBe(150);  // srcX
            expect(calls[0].args[3]).toBe(50);   // srcW
            expect(calls[0].args[5]).toBe(0);    // destX
            expect(calls[0].args[7]).toBe(50);   // destW
            // Second strip
            expect(calls[1].args[1]).toBe(0);    // srcX
            expect(calls[1].args[3]).toBe(150);  // srcW
            expect(calls[1].args[5]).toBe(50);   // destX
            expect(calls[1].args[7]).toBe(150);  // destW
        });

        test('does nothing for zero-width region', () => {
            const skybox = createTestSkybox(200, 100);
            const { context, calls } = createMockTargetContext();
            const region: ISkyboxRegion = { x: 0, y: 0, width: 0, height: 100 };

            skybox.drawTiled(context, 0, 0, 200, 300, 0, region, true);

            expect(calls).toHaveLength(0);
        });

        test('does nothing for zero-height region', () => {
            const skybox = createTestSkybox(200, 100);
            const { context, calls } = createMockTargetContext();
            const region: ISkyboxRegion = { x: 0, y: 0, width: 200, height: 0 };

            skybox.drawTiled(context, 0, 0, 200, 300, 0, region, true);

            expect(calls).toHaveLength(0);
        });
    });
});
