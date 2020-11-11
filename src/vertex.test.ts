import { Vertex } from "./vertex";
import math = require("mathjs");

describe('vertex tests', () => {
  describe('dimension tests', () => {
    it('one dimensional vertices', () => expect(new Vertex(1).dim()).toBe(1));
    it('two dimensional vertices', () => expect(new Vertex(1, 1).dim()).toBe(2));
    it('three dimensional vertices', () => expect(new Vertex(1, 1, 1).dim()).toBe(3));
  });

  describe('component getter tests', () => {
    it('x component', () => expect(new Vertex(1, 2).x).toBe(1));
    it('y component', () => expect(new Vertex(1, 2).y).toBe(2));
  });

  describe('norm tests', () => {
    it('||(0,1)|| = 1', () => expect(new Vertex(0,1).norm()).toBe(1));
    it('||(1,0)|| = 1', () => expect(new Vertex(1,0).norm()).toBe(1));
    it('||(0,-2)|| = 2', () => expect(new Vertex(0,-2).norm()).toBe(2));
    it('||(-2,0)|| = 2', () => expect(new Vertex(-2,0).norm()).toBe(2));
    it('||(3,4)|| = 5', () => expect(new Vertex(3,4).norm()).toBe(5));
  });

  describe('dot product tests', () => {
    const test = (x: number[], y: number[], e: number) => expect(new Vertex(...x).dot(new Vertex(...y))).toEqual(e);    
    it('(0,0).(1,1) = 0', () => test([0,0], [1,1], 0));
    it('(0,1).(1,0) = 0', () => test([0,1], [1,0], 0));
    it('(1,1).(1,1) = 2', () => test([1,1], [1,1], 2));
    it('(1,2).(3,4) = 11', () => test([1,2],[3,4], 11));
  });

  describe('substract tests', () => {
    const test = (x: number[], y: number[], e: number[]) => expect(new Vertex(...x).subtract(new Vertex(...y)).coordinates).toEqual(e);
    it('1 - 0 = 1', () => test([1,1], [0,0], [1,1]));
    it('0 - 1 = -1', () => test([0,0], [1,1], [-1,-1]));
    it('1 - 1 = 0', () => test([1,1], [1,1], [0,0]));
  });
  describe('add tests', () => {
    const test = (x: number[], y: number[], e: number[]) => expect(new Vertex(...x).add(new Vertex(...y)).coordinates).toEqual(e);
    it('1 + 0 = 1', () => test([1,1], [0,0], [1,1]));
    it('0 + 1 = 1', () => test([0,0], [1,1], [1,1]));
    it('0 + 0 = 0', () => test([0,0], [0,0], [0,0]));
  });
  describe('scale tests', () => {
    const test = (x: number[], factor: number, e: number[]) => expect(new Vertex(...x).scale(factor).coordinates).toEqual(e);
    it('[1,1] * 0 = 0', () => test([1,1], 0, [0,0]));    
    it('[1,1] * 1/100 = .01', () => test([1,1], 1/100, [0.01,0.01]));    
  });
  describe('rotation tests', () => {
    const test = (components: number[], angle: number, e: number[]) => {
      const actual = new Vertex(...components).rotate(angle);
      actual.coordinates.map((_, i) => expect(_).toBeCloseTo(e[i]));
    };
    it('[1,0] by 0 = [1,0]', () => test([1,0], 0, [1,0]));
    it('[1,0] by pi/2 = [0,1]', () => test([1,0], math.pi/2, [0,1]));
    it('[1,0] by pi = [-1,0]', () => test([1,0], math.pi, [-1,0]));
    it('[1,0] by 3/2*pi = [0,-1]', () => test([1,0], 3/2*math.pi, [0,-1]));
    it('[1,0] by 2*pi = [1,0]', () => test([1,0], 2*math.pi, [1,0]));
    it('[1,0] by pi/4 = [cos(pi/4),sin(pi/4)]', () => test([1,0], math.pi/4, [math.cos(math.pi/4), math.sin(math.pi/4)]));
    it('[0,2] by pi/2 = [-2,0]', () => test([0,2], math.pi/2, [-2,0]));
  });  
});
