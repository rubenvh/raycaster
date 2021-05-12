import { Texture } from "./texture";
import 'jest-canvas-mock';

describe('texture tests', () => {
    describe('rows and columns', () => {
        const sut = new Texture({path: './assets/textures/001.jpg', textureWidth: 192, textureHeight: 192});

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
});