import { add, angleBetween, areOrthogonal, distance, dot, getX, getY, norm, normalize, normSqr, perpendicular, proj, rotate, scale, subtract, Vector } from "./vector";
import math = require("mathjs");

describe('vector tests', () => {  
  describe('component getter tests', () => {
    it('x component', () => expect(getX([1, 2])).toBe(1));
    it('y component', () => expect(getY([1, 2])).toBe(2));
  });  
  describe('dot product tests', () => {
    const test = (x: Vector, y: Vector, e: number) => expect(dot(x, y)).toEqual(e);    
    it('(0,0).(1,1) = 0',  () => test([0,0], [1,1], 0));
    it('(0,1).(1,0) = 0',  () => test([0,1], [1,0], 0));
    it('(1,1).(1,1) = 2',  () => test([1,1], [1,1], 2));
    it('(1,2).(3,4) = 11', () => test([1,2], [3,4], 11));
  });
  describe('norm tests', () => {
    it('||(0,1)|| = 1', () =>  expect(norm([ 0, 1])).toBe(1));
    it('||(1,0)|| = 1', () =>  expect(norm([ 1, 0])).toBe(1));
    it('||(0,-2)|| = 2', () => expect(norm([ 0,-2])).toBe(2));
    it('||(-2,0)|| = 2', () => expect(norm([-2, 0])).toBe(2));
    it('||(3,4)|| = 5', () =>  expect(norm([ 3, 4])).toBe(5));
  });
  describe('normSqr tests', () => {
    it('(0,0) => 0', () =>  expect(normSqr([ 0, 0])).toBe(0));
    it('(0,1) => 1', () =>  expect(normSqr([ 0, 1])).toBe(1));
    it('(1,1) => 2', () =>  expect(normSqr([ 1, 1])).toBe(2));    
    it('(2,1) => 5', () =>  expect(normSqr([ 2, 1])).toBe(5));    
    it('(2,3) => 13', () =>  expect(normSqr([ 2, 3])).toBe(13));    
    it('(2,-3) => 13', () =>  expect(normSqr([ 2, -3])).toBe(13));    
    it('(-2,-3) => 13', () =>  expect(normSqr([ -2, -3])).toBe(13));    
  });
  describe('normalize tests: A / ||A||', () => {
    it('( 0,  0) => (NaN, NaN)', () =>  expect(normalize([ 0, 0])).toEqual([NaN, NaN]));    
    it('( 1,  0) => (1, 0)', () =>  expect(normalize([ 0, 1])).toEqual([0, 1]));    
    it('( 0,  1) => (0, 1)', () =>  expect(normalize([ 1, 0])).toEqual([1, 0]));    
    it('(10,  0) => (1, 0)', () =>  expect(normalize([ 0, 10])).toEqual([0, 1]));    
    it('( 0, 10) => (0, 1)', () =>  expect(normalize([ 10, 0])).toEqual([1, 0]));    
    it('( 1,  1) => (1/sqrt(2), 1/sqrt(2))', () =>  expect(normalize([   1,  1])).toEqual([ 1/Math.SQRT2,  1/Math.SQRT2]));    
    it('(-1,  1) => (-1/sqrt(2), 1/sqrt(2))', () =>  expect(normalize([ -1,  1])).toEqual([-1/Math.SQRT2,  1/Math.SQRT2]));    
    it('( 1, -1) => (1/sqrt(2), -1/sqrt(2))', () =>  expect(normalize([  1, -1])).toEqual([ 1/Math.SQRT2, -1/Math.SQRT2]));    
    it('(-1, -1) => (-1/sqrt(2), -1/sqrt(2))', () =>  expect(normalize([-1, -1])).toEqual([-1/Math.SQRT2, -1/Math.SQRT2]));    
  });
  describe('substract tests', () => {
    const test = (x: Vector, y: Vector, e: Vector) => expect(subtract(x, y)).toEqual(e);
    it('1 - 0 = 1',  () => test([1,1], [0,0], [ 1, 1]));
    it('0 - 1 = -1', () => test([0,0], [1,1], [-1,-1]));
    it('1 - 1 = 0',  () => test([1,1], [1,1], [ 0, 0]));
  });
  describe('add tests', () => {
    const test = (x: Vector, y: Vector, e: Vector) => expect(add(x, y)).toEqual(e);
    it('1 + 0 = 1', () => test([1,1], [0,0], [1,1]));
    it('0 + 1 = 1', () => test([0,0], [1,1], [1,1]));
    it('0 + 0 = 0', () => test([0,0], [0,0], [0,0]));
  });
  describe('scale tests', () => {
    const test = (x: Vector, factor: number, e: Vector) => expect(scale(factor, x)).toEqual(e);
    it('[1,1] * 0 = 0',       () => test([1,1], 0,     [0,0]));    
    it('[1,1] * 1/100 = .01', () => test([1,1], 1/100, [0.01,0.01]));    
  });
  describe('rotation tests', () => {
    const test = (u: Vector, angle: number, e: number[]) => {
      const actual = rotate(angle, u);
      actual.map((_, i) => expect(_).toBeCloseTo(e[i]));
    };
    it('[1,0] by 0      = [1,0]',                 () => test([1,0], 0, [1,0]));
    it('[1,0] by pi/2   = [0,1]',                 () => test([1,0], math.pi/2, [0,1]));
    it('[1,0] by pi     = [-1,0]',                () => test([1,0], math.pi, [-1,0]));
    it('[1,0] by 3/2*pi = [0,-1]',                () => test([1,0], 3/2*math.pi, [0,-1]));
    it('[1,0] by 2*pi   = [1,0]',                 () => test([1,0], 2*math.pi, [1,0]));
    it('[1,0] by pi/4   = [cos(pi/4),sin(pi/4)]', () => test([1,0], math.pi/4, [math.cos(math.pi/4), math.sin(math.pi/4)]));
    it('[0,2] by pi/2   = [-2,0]',                () => test([0,2], math.pi/2, [-2,0]));
  });  
  describe('orthogonality checks', () => {
    const test = (u: Vector, v: Vector, e: boolean) => expect(areOrthogonal(u, v)).toEqual(e);
    it('[0,1] orthogonal to [1,0]',     () => test([0,1], [ 1,0], true));
    it('[1,1] orthogonal to [-1,1]',    () => test([1,1], [-1,1], true));
    it('[2,3] orthogonal to [-3,2]',    () => test([2,3], [-3,2], true));
    it('[1,0] not orthogonal to [-1,0]',() => test([1,0], [-1,0], false));
    it('[1,1] not orthogonal to [1,0]', () => test([1,1], [ 1,0], false));
  });
  describe('distance calculation', () => {
    const test = (u: Vector, v: Vector, e: number) => expect(distance(u, v)).toEqual(e);
    it('d([0,1],[1,0])', () => test([0,1], [1,0], math.sqrt(2)));
    it('d([0,0],[1,0])', () => test([0,0], [1,0], 1));
    it('d([0,3],[4,0])', () => test([0,3], [4,0], 5));
  });
  describe('angle calculation', () => {
    const test = (u: Vector, v: Vector, e: number) => expect(angleBetween(u, v)).toBeCloseTo(e);    
    it('angle([0, 1],[1, 0]) = -pi/2', () => test([0,1], [1, 0], -math.pi/2));
    it('angle([1, 0],[0, 1]) = pi/2',  () => test([1, 0],[0, 1], math.pi/2));
    it('angle([0, 1],[0, 2]) = 0',    () => test([0,1], [0, 2], 0));    
    it('angle([1, 0],[-1,0]) = pi',   () => test([1,0], [-1,0], math.pi));
    it('angle([1, 1],[0, 1]) = pi/4', () => test([1,1], [0, 1], math.pi/4));
    it('angle([1, 0],[0,-1]) = -pi/2', () => test([1,0], [0,-1], -math.pi/2));
    it('angle([5.45,1.12],[-3.86, 4.32]) = 120.17`', () => test([5.45,1.12],[-3.86, 4.32], 120.17*Math.PI/180));
  });
  describe('projection tests', () => {
    const test = (u: Vector, v: Vector, e: Vector) => expect(proj(u, v)).toEqual(e);
    it('proj([1,0],[0,1])     = [0,0]',       () => test([1,0],[0,1], [0,0]));    
  });
  describe('perpendicular calculation', () => {
    const test = (u: Vector, e: Vector) => {
      const n = perpendicular(u);
      expect(n).toEqual(e);    
      expect(dot(n, u)).toEqual(0);
    }
    it('perpendicular: [0,1] ==> [-1,0]', () => test([0, 1], [-1, 0]));
    it('perpendicular: [2,2] ==> [-2,2]', () => test([2, 2], [-2, 2]));
  });

});

