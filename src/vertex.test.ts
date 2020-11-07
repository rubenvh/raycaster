import { Vertex, Camera } from "./vertex";


test('dimensional vertices have correct dimension', () => {
  expect(new Vertex(1).dim()).toBe(1);
  expect(new Vertex(1, 1).dim()).toBe(2);
  expect(new Vertex(1, 1, 1).dim()).toBe(3);
});

describe('camera tests', () => {
  test('camera init', () => {
    let sut = new Camera(new Vertex(3,2), new Vertex(6, 3));

    
    console.dir(sut.screen);
  });
});
