import 'jest-canvas-mock';

// Store the connect callbacks for testing
const connectCallbacks: Function[] = [];

// Mock store-connector to avoid Redux dependency
jest.mock('../store/store-connector', () => ({
    connect: jest.fn((cb: Function) => {
        connectCallbacks.push(cb);
        // Call with initial empty state
        cb({ textures: { sources: [] } });
        return jest.fn();
    }),
}));

// Import after mocking
import { TextureLibrary } from './textureLibrary';

const getLatestCallback = (): Function => connectCallbacks[connectCallbacks.length - 1];

describe('TextureLibrary', () => {
    let lib: TextureLibrary;

    beforeEach(() => {
        lib = new TextureLibrary();
    });

    test('initializes with empty textures', () => {
        expect(lib.textures).toEqual([]);
    });

    test('updates textures when store state changes', () => {
        const sources = [
            { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
        ];
        getLatestCallback()({ textures: { sources } });
        expect(lib.textures.length).toBe(1);
        expect(lib.textures[0].id).toBe('tex1');
    });

    test('does not recreate textures if sources are same reference', () => {
        const sources = [
            { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
        ];
        getLatestCallback()({ textures: { sources } });
        const firstTextures = lib.textures;
        // Same reference — should not recreate
        getLatestCallback()({ textures: { sources } });
        expect(lib.textures).toBe(firstTextures);
    });

    describe('lookupTexture', () => {
        test('returns null when material has no texture', () => {
            expect(lib.lookupTexture({ color: [255, 0, 0, 1] })).toBeNull();
        });

        test('returns null when material is null', () => {
            expect(lib.lookupTexture(null as any)).toBeNull();
        });

        test('returns texture when material has texture reference', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            const result = lib.lookupTexture({ color: [255, 0, 0, 1], texture: { id: 'tex1', index: 0 } });
            expect(result).toBeDefined();
            expect(result!.id).toBe('tex1');
        });
    });

    describe('getTexture', () => {
        test('returns texture by id', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
                { id: 'tex2', textureWidth: 32, textureHeight: 32, totalWidth: 64, totalHeight: 64, data: 'BBBB', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            const t = lib.getTexture('tex2');
            expect(t).toBeDefined();
            expect(t!.id).toBe('tex2');
        });

        test('returns undefined for non-existent id', () => {
            expect(lib.getTexture('nonexistent')).toBeUndefined();
        });
    });

    describe('getTextureReferences', () => {
        test('returns references for all texture parts', () => {
            // 128x128 total, 64x64 per texture = 2 cols x 2 rows = 4 parts
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            const refs = lib.getTextureReferences('tex1');
            expect(refs.length).toBe(4);
            expect(refs[0]).toEqual({ id: 'tex1', index: 0 });
            expect(refs[3]).toEqual({ id: 'tex1', index: 3 });
        });

        test('returns empty array for non-existent texture', () => {
            const refs = lib.getTextureReferences('nonexistent');
            expect(refs.length).toBe(0);
        });
    });

    describe('previous', () => {
        test('decrements index when index > 0', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            const ref = lib.previous({ id: 'tex1', index: 2 });
            expect(ref).toEqual({ id: 'tex1', index: 1 });
        });

        test('wraps to next texture when index is 0', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
                { id: 'tex2', textureWidth: 32, textureHeight: 32, totalWidth: 64, totalHeight: 64, data: 'BBBB', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            const ref = lib.previous({ id: 'tex1', index: 0 });
            expect(ref.id).toBe('tex2');
        });

        test('wraps to first texture when at last texture index 0', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            // Only one texture, wrapping from index 0 goes back to tex1
            const ref = lib.previous({ id: 'tex1', index: 0 });
            expect(ref.id).toBe('tex1');
        });
    });

    describe('next', () => {
        test('increments index when not at last part', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            const ref = lib.next({ id: 'tex1', index: 0 });
            expect(ref).toEqual({ id: 'tex1', index: 1 });
        });

        test('wraps to next texture when at last part', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
                { id: 'tex2', textureWidth: 32, textureHeight: 32, totalWidth: 64, totalHeight: 64, data: 'BBBB', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            // tex1 has 4 parts (indices 0-3), going next from index 3 should wrap
            const ref = lib.next({ id: 'tex1', index: 3 });
            expect(ref.id).toBe('tex2');
            expect(ref.index).toBe(0);
        });

        test('wraps to first texture when at last texture last part', () => {
            const sources = [
                { id: 'tex1', textureWidth: 64, textureHeight: 64, totalWidth: 128, totalHeight: 128, data: 'AAAA', mimeType: 'image/png' },
            ];
            getLatestCallback()({ textures: { sources } });
            // 4 parts, going next from last
            const ref = lib.next({ id: 'tex1', index: 3 });
            expect(ref.id).toBe('tex1');
            expect(ref.index).toBe(0);
        });
    });

    describe('waitForLoad', () => {
        test('resolves when no textures', async () => {
            await expect(lib.waitForLoad()).resolves.toEqual([]);
        });
    });
});
