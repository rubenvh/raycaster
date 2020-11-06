import { Vertex } from "./vertex";


test('dimensional vertices have correct dimension', () => {
  expect(new Vertex(1).dim()).toBe(1);
  expect(new Vertex(1, 1).dim()).toBe(2);
  expect(new Vertex(1, 1, 1).dim()).toBe(3);
});