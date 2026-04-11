import { Texture } from "./texture";
import 'jest-canvas-mock';
import * as fs from "fs";
import { imageSize } from 'image-size';  

describe('texture tests', () => {
    let base64: string;
    let sut: Texture;
    beforeAll(() => {
        const path = "./assets/textures/001.jpg";        
        const buffer = fs.readFileSync(path);        
        const dimensions = imageSize(buffer);
        base64 = Buffer.from(buffer).toString('base64');        
        sut = new Texture({data: base64, textureWidth: 192, textureHeight: 192, totalHeight: dimensions.height, totalWidth: dimensions.width});
    });

    describe('rows and columns', () => {        

        test('expect 16 parts inside texture', () => expect(sut.parts).toBe(16));
        test('expect index 0  to be [0, 0]', () => expect(sut.getPosition(0 )).toEqual([0, 0]));
        test('expect index 1  to be [1, 0]', () => expect(sut.getPosition(1 )).toEqual([1, 0]));
        test('expect index 2  to be [2, 0]', () => expect(sut.getPosition(2 )).toEqual([2, 0]));
        test('expect index 3  to be [3, 0]', () => expect(sut.getPosition(3 )).toEqual([3, 0]));
        test('expect index 4  to be [0, 1]', () => expect(sut.getPosition(4 )).toEqual([0, 1]));
        test('expect index 5  to be [1, 1]', () => expect(sut.getPosition(5 )).toEqual([1, 1]));
        test('expect index 6  to be [2, 1]', () => expect(sut.getPosition(6 )).toEqual([2, 1]));
        test('expect index 7  to be [3, 1]', () => expect(sut.getPosition(7 )).toEqual([3, 1]));
        test('expect index 8  to be [0, 2]', () => expect(sut.getPosition(8 )).toEqual([0, 2]));
        test('expect index 9  to be [1, 2]', () => expect(sut.getPosition(9 )).toEqual([1, 2]));
        test('expect index 10 to be [2, 2]', () => expect(sut.getPosition(10)).toEqual([2, 2]));
        test('expect index 11 to be [3, 2]', () => expect(sut.getPosition(11)).toEqual([3, 2]));
        test('expect index 12 to be [0, 3]', () => expect(sut.getPosition(12)).toEqual([0, 3]));
        test('expect index 13 to be [1, 3]', () => expect(sut.getPosition(13)).toEqual([1, 3]));
        test('expect index 14 to be [2, 3]', () => expect(sut.getPosition(14)).toEqual([2, 3]));
        test('expect index 15 to be [3, 3]', () => expect(sut.getPosition(15)).toEqual([3, 3]));
    });

    describe('getSubTexturePixels', () => {
        test('returns null when texture is not loaded', () => {
            // In test environment, Image.onload doesn't fire, so _isLoaded stays false
            const unloaded = new Texture({
                data: base64,
                textureWidth: 192,
                textureHeight: 192,
                totalHeight: 768,
                totalWidth: 768,
            });
            expect(unloaded.getSubTexturePixels(0)).toBeNull();
        });

        test('returns pixel data with correct dimensions when loaded', () => {
            (sut as any)._isLoaded = true;
            const result = sut.getSubTexturePixels(0);
            expect(result).not.toBeNull();
            expect(result!.width).toBe(192);
            expect(result!.height).toBe(192);
        });

        test('returns Uint8ClampedArray with correct pixel count (RGBA)', () => {
            (sut as any)._isLoaded = true;
            const result = sut.getSubTexturePixels(0);
            expect(result!.data.length).toBe(192 * 192 * 4);
        });

        test('caches result on repeated calls (same reference)', () => {
            (sut as any)._isLoaded = true;
            const first = sut.getSubTexturePixels(5);
            const second = sut.getSubTexturePixels(5);
            expect(first).toBe(second);
        });

        test('returns different cached objects for different indices', () => {
            (sut as any)._isLoaded = true;
            const a = sut.getSubTexturePixels(0);
            const b = sut.getSubTexturePixels(5);
            expect(a).not.toBe(b);
            expect(a!.width).toBe(b!.width);
            expect(a!.height).toBe(b!.height);
        });

        test('calls getImageData with correct sub-texture region', () => {
            const freshTexture = new Texture({
                data: base64,
                textureWidth: 192,
                textureHeight: 192,
                totalHeight: 768,
                totalWidth: 768,
            });
            (freshTexture as any)._isLoaded = true;
            const spy = jest.spyOn((freshTexture as any).context, 'getImageData');

            // Index 5 = position [1, 1] (col=1, row=1 for a 4-column atlas)
            freshTexture.getSubTexturePixels(5);

            expect(spy).toHaveBeenCalledWith(
                1 * 192, // col * textureWidth
                1 * 192, // row * textureHeight
                192, 192  // textureWidth, textureHeight
            );
        });
    });
});