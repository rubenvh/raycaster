import { 
  add, angleBetween, areEqual, areOrthogonal, cross, distance, dot, 
  norm, normalize, normSqr, perpendicular, proj, rotate, scale, subtract, 
  Vector, ZERO, copyIn, snap, minimumComponents, maximumComponents, round,
  subtractInto, addInto, scaleInto 
} from "./vector";

describe('vector tests', () => {   
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
  describe('scale tests', () => {
    const test = (x: Vector, factor: number, e: Vector) => expect(scale(factor, x)).toEqual(e);
    it('[1,1] * 0 = 0',       () => test([1,1], 0,     [0,0]));    
    it('[1,1] * 1/100 = .01', () => test([1,1], 1/100, [0.01,0.01]));    
    it('[1,-2] * -3 = [-3, 6]', () => test([1,-2], -3, [-3,6]));    
  });
  describe('substract tests', () => {
    const test = (x: Vector, y: Vector, e: Vector) => expect(subtract(x, y)).toEqual(e);
    it('1 - 0 = 1',  () => test([1,1], [0,0], [ 1, 1]));
    it('0 - 1 = -1', () => test([0,0], [1,1], [-1,-1]));
    it('1 - 1 = 0',  () => test([1,1], [1,1], [ 0, 0]));
    it('[1,2] - [3,4] = [-2,-2]',  () => test([1,2], [3,4], [-2,-2]));
  });
  describe('add tests', () => {
    const test = (x: Vector, y: Vector, e: Vector) => expect(add(x, y)).toEqual(e);
    it('1 + 0 = 1', () => test([1,1], [0,0], [1,1]));
    it('0 + 1 = 1', () => test([0,0], [1,1], [1,1]));
    it('0 + 0 = 0', () => test([0,0], [0,0], [0,0]));
    it('[1,2] + [3,4] = [4,6]',  () => test([1,2], [3,4], [4,6]));
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
    it('d([0,1],[1,0])', () => test([0,1], [1,0], Math.sqrt(2)));
    it('d([0,0],[1,0])', () => test([0,0], [1,0], 1));
    it('d([0,3],[4,0])', () => test([0,3], [4,0], 5));
  });
  describe('angle calculation', () => {
    const test = (u: Vector, v: Vector, e: number) => expect(angleBetween(u, v)).toBeCloseTo(e);    
    it('angle([0, 1],[1, 0]) = -pi/2', () => test([0,1], [1, 0], -Math.PI/2));
    it('angle([1, 0],[0, 1]) = pi/2',  () => test([1, 0],[0, 1], Math.PI/2));
    it('angle([0, 1],[0, 2]) = 0',    () => test([0,1], [0, 2], 0));    
    it('angle([1, 0],[-1,0]) = pi',   () => test([1,0], [-1,0], Math.PI));
    it('angle([1, 1],[0, 1]) = pi/4', () => test([1,1], [0, 1], Math.PI/4));
    it('angle([1, 0],[0,-1]) = -pi/2', () => test([1,0], [0,-1], -Math.PI/2));
    it('angle([5.45,1.12],[-3.86, 4.32]) = 120.17`', () => test([5.45,1.12],[-3.86, 4.32], 120.17*Math.PI/180));
  });
  describe('projection tests', () => {
    const test = (u: Vector, v: Vector, e: Vector) => expect(proj(u, v)).toEqual(e);
    it('proj([1,0],[0,1])     = [0,0]',       () => test([1,0],[0,1], [0,0]));    
    it('proj([1,1],[1,0])     = [1,0]',       () => test([1,1],[1,0], [1,0]));    
    it('proj([1,0],[1,1])     = [.5,.5]',       () => test([1,0],[1,1], [0.5,0.5]));    
  });
  describe('rotation tests', () => {
    const test = (u: Vector, angle: number, e: number[]) => {
      const actual = rotate(angle, u);
      actual.map((_, i) => expect(_).toBeCloseTo(e[i]));
    };
    it('[1,0] by 0      = [1,0]',                 () => test([1,0], 0, [1,0]));
    it('[1,0] by pi/2   = [0,1]',                 () => test([1,0], Math.PI/2, [0,1]));
    it('[1,0] by pi     = [-1,0]',                () => test([1,0], Math.PI, [-1,0]));
    it('[1,0] by 3/2*pi = [0,-1]',                () => test([1,0], 3/2*Math.PI, [0,-1]));
    it('[1,0] by 2*pi   = [1,0]',                 () => test([1,0], 2*Math.PI, [1,0]));
    it('[1,0] by pi/4   = [cos(pi/4),sin(pi/4)]', () => test([1,0], Math.PI/4, [Math.cos(Math.PI/4), Math.sin(Math.PI/4)]));
    it('[0,2] by pi/2   = [-2,0]',                () => test([0,2], Math.PI/2, [-2,0]));
  });
  describe('cross product tests', () => {
    const test = (u: Vector, v: Vector, e: number) => expect(cross(u, v)).toEqual(e);
    it('', ()=>test([0,0],[1,2],0));
    it('', ()=>test([1,2],[0,0],0));
    it('', ()=>test([1,2],[3,4],4-6));
    it('', ()=>test([1,-2],[3,-4],-4+6));
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

  describe('ZERO constant', () => {
    it('is [0, 0]', () => expect(ZERO).toEqual([0, 0]));
    it('has zero norm', () => expect(norm(ZERO)).toBe(0));
  });

  describe('areEqual tests', () => {
    it('identical vectors are equal', () => expect(areEqual([1, 2], [1, 2])).toBe(true));
    it('different vectors are not equal', () => expect(areEqual([1, 2], [1, 3])).toBe(false));
    it('zero vectors are equal', () => expect(areEqual([0, 0], [0, 0])).toBe(true));
    it('negative vectors equality', () => expect(areEqual([-1, -2], [-1, -2])).toBe(true));
    it('order matters for components', () => expect(areEqual([1, 2], [2, 1])).toBe(false));
  });

  describe('copyIn tests', () => {
    it('copies values into target vector', () => {
      const target: Vector = [0, 0];
      const source: Vector = [5, 10];
      const result = copyIn(target, source);
      expect(target).toEqual([5, 10]);
      expect(result).toBe(target); // same reference
    });
    it('overwrites existing values', () => {
      const target: Vector = [100, 200];
      copyIn(target, [-1, -2]);
      expect(target).toEqual([-1, -2]);
    });
  });

  describe('snap tests (round to grid of 10)', () => {
    it('snaps [0, 0] to [0, 0]', () => expect(snap([0, 0])).toEqual([0, 0]));
    it('snaps [5, 5] to [10, 10]', () => expect(snap([5, 5])).toEqual([10, 10]));
    it('snaps [4, 4] to [0, 0]', () => expect(snap([4, 4])).toEqual([0, 0]));
    it('snaps [15, 25] to [20, 30]', () => expect(snap([15, 25])).toEqual([20, 30]));
    it('snaps negative values [-15, -25] to [-10, -20]', () => expect(snap([-15, -25])).toEqual([-10, -20]));
    it('snaps [12, 18] to [10, 20]', () => expect(snap([12, 18])).toEqual([10, 20]));
  });

  describe('minimumComponents tests', () => {
    it('returns minimum of each component', () => expect(minimumComponents([1, 5], [3, 2])).toEqual([1, 2]));
    it('handles identical vectors', () => expect(minimumComponents([2, 2], [2, 2])).toEqual([2, 2]));
    it('handles negative values', () => expect(minimumComponents([-1, 5], [3, -2])).toEqual([-1, -2]));
    it('handles zero', () => expect(minimumComponents([0, 5], [3, 0])).toEqual([0, 0]));
  });

  describe('maximumComponents tests', () => {
    it('returns maximum of each component', () => expect(maximumComponents([1, 5], [3, 2])).toEqual([3, 5]));
    it('handles identical vectors', () => expect(maximumComponents([2, 2], [2, 2])).toEqual([2, 2]));
    it('handles negative values', () => expect(maximumComponents([-1, 5], [3, -2])).toEqual([3, 5]));
    it('handles zero', () => expect(maximumComponents([0, 5], [3, 0])).toEqual([3, 5]));
  });

  describe('round tests', () => {
    it('rounds [1.4, 2.6] to [1, 3]', () => expect(round([1.4, 2.6])).toEqual([1, 3]));
    it('rounds [1.5, 2.5] to [2, 3]', () => expect(round([1.5, 2.5])).toEqual([2, 3]));
    it('rounds integers unchanged', () => expect(round([5, 10])).toEqual([5, 10]));
    it('rounds negative values [-1.4, -2.6] to [-1, -3]', () => expect(round([-1.4, -2.6])).toEqual([-1, -3]));
  });

  describe('subtractInto tests (in-place)', () => {
    it('subtracts vectors into output', () => {
      const out: Vector = [0, 0];
      const result = subtractInto(out, [5, 10], [2, 3]);
      expect(out).toEqual([3, 7]);
      expect(result).toBe(out); // same reference
    });
    it('overwrites existing output values', () => {
      const out: Vector = [100, 200];
      subtractInto(out, [1, 2], [3, 4]);
      expect(out).toEqual([-2, -2]);
    });
  });

  describe('addInto tests (in-place)', () => {
    it('adds vectors into output', () => {
      const out: Vector = [0, 0];
      const result = addInto(out, [5, 10], [2, 3]);
      expect(out).toEqual([7, 13]);
      expect(result).toBe(out); // same reference
    });
    it('overwrites existing output values', () => {
      const out: Vector = [100, 200];
      addInto(out, [1, 2], [3, 4]);
      expect(out).toEqual([4, 6]);
    });
  });

  describe('scaleInto tests (in-place)', () => {
    it('scales vector into output', () => {
      const out: Vector = [0, 0];
      const result = scaleInto(out, 3, [2, 4]);
      expect(out).toEqual([6, 12]);
      expect(result).toBe(out); // same reference
    });
    it('overwrites existing output values', () => {
      const out: Vector = [100, 200];
      scaleInto(out, 0.5, [10, 20]);
      expect(out).toEqual([5, 10]);
    });
    it('handles zero scalar', () => {
      const out: Vector = [100, 200];
      scaleInto(out, 0, [10, 20]);
      expect(out).toEqual([0, 0]);
    });
  });

});

