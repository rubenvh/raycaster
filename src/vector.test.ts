import { OldVector } from "./vector";
import math = require("mathjs");

describe('vector tests', () => {
  describe('dimension tests', () => {
    it('one dimensional vertices', () => expect(new OldVector(1).dim()).toBe(1));
    it('two dimensional vertices', () => expect(new OldVector(1, 1).dim()).toBe(2));
    it('three dimensional vertices', () => expect(new OldVector(1, 1, 1).dim()).toBe(3));
  });

  describe('component getter tests', () => {
    it('x component', () => expect(new OldVector(1, 2).x).toBe(1));
    it('y component', () => expect(new OldVector(1, 2).y).toBe(2));
  });

  describe('norm tests', () => {
    it('||(0,1)|| = 1', () => expect(new OldVector(0,1).norm()).toBe(1));
    it('||(1,0)|| = 1', () => expect(new OldVector(1,0).norm()).toBe(1));
    it('||(0,-2)|| = 2', () => expect(new OldVector(0,-2).norm()).toBe(2));
    it('||(-2,0)|| = 2', () => expect(new OldVector(-2,0).norm()).toBe(2));
    it('||(3,4)|| = 5', () => expect(new OldVector(3,4).norm()).toBe(5));
  });

  describe('dot product tests', () => {
    const test = (x: number[], y: number[], e: number) => expect(new OldVector(...x).dot(new OldVector(...y))).toEqual(e);    
    it('(0,0).(1,1) = 0', () => test([0,0], [1,1], 0));
    it('(0,1).(1,0) = 0', () => test([0,1], [1,0], 0));
    it('(1,1).(1,1) = 2', () => test([1,1], [1,1], 2));
    it('(1,2).(3,4) = 11', () => test([1,2],[3,4], 11));
  });

  describe('substract tests', () => {
    const test = (x: number[], y: number[], e: number[]) => expect(new OldVector(...x).subtract(new OldVector(...y)).coordinates).toEqual(e);
    it('1 - 0 = 1', () => test([1,1], [0,0], [1,1]));
    it('0 - 1 = -1', () => test([0,0], [1,1], [-1,-1]));
    it('1 - 1 = 0', () => test([1,1], [1,1], [0,0]));
  });
  describe('add tests', () => {
    const test = (x: number[], y: number[], e: number[]) => expect(new OldVector(...x).add(new OldVector(...y)).coordinates).toEqual(e);
    it('1 + 0 = 1', () => test([1,1], [0,0], [1,1]));
    it('0 + 1 = 1', () => test([0,0], [1,1], [1,1]));
    it('0 + 0 = 0', () => test([0,0], [0,0], [0,0]));
  });
  describe('scale tests', () => {
    const test = (x: number[], factor: number, e: number[]) => expect(new OldVector(...x).scale(factor).coordinates).toEqual(e);
    it('[1,1] * 0 = 0', () => test([1,1], 0, [0,0]));    
    it('[1,1] * 1/100 = .01', () => test([1,1], 1/100, [0.01,0.01]));    
  });
  describe('rotation tests', () => {
    const test = (components: number[], angle: number, e: number[]) => {
      const actual = new OldVector(...components).rotate(angle);
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
  describe('orthogonality checks', () => {
    const test = (u: number[], v: number[], e: boolean) => expect(new OldVector(...u).isOrthogonalTo(new OldVector(...v))).toEqual(e);
    it('[0,1] orthogonal to [1,0]', () => test([0,1], [1,0], true));
    it('[1,1] orthogonal to [-1,1]', () => test([1,1], [-1,1], true));
    it('[2,3] orthogonal to [-3,2]', () => test([2,3], [-3,2], true));
    it('[1,0] not orthogonal to [-1,0]', () => test([1,0], [-1,0], false));
    it('[1,1] not orthogonal to [1,0]', () => test([1,1], [1,0], false));
  });
  describe('distance calculation', () => {
    const test = (u: number[], v: number[], e: number) => expect(new OldVector(...u).distanceTo(new OldVector(...v))).toEqual(e);
    it('d([0,1],[1,0])', () => test([0,1], [1,0], math.sqrt(2)));
    it('d([0,0],[1,0])', () => test([0,0], [1,0], 1));
    it('d([0,3],[4,0])', () => test([0,3], [4,0], 5));
  });
  describe('angle calculation', () => {
    const test = (u: number[], v: number[], e: number) => expect(new OldVector(...u).angleWith(new OldVector(...v))).toBeCloseTo(e);
    it('d([0,1],[1,0])', () => test([0,1], [1,0], math.pi/2));
    it('d([0,1],[0,2])', () => test([0,1], [0,2], 0));
    it('d([0,1],[0,-1])', () => test([0,1], [0,-1], math.pi));
    it('d([1,1],[0,1])', () => test([1,1], [0,1], math.pi/4));
    it('d([1,0],[0,-1])', () => test([1,0], [0,-1], math.pi/2));
  });
  describe('projection tests', () => {
    const test = (u: number[], v: number[], e: number[]) => expect(new OldVector(...u).proj(new OldVector(...v)).coordinates).toEqual(e);
    it('proj([1,0],[0,1])', () => test([1,0],[0,1], [0,0]));
    it('proj([1,-2,3],[2,4,5])', () => test([1,-2,3],[2,4,5], [2/5,4/5,1]));
  });

});

