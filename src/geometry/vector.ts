import { create, all } from 'mathjs'

const config = { }
export const math = create(all, config)

export type Vector = number[];

const getX = (u: Vector): number => u[0];
const getY = (u: Vector): number => u[1];
const dim = (u: Vector): number => u.length;
const zip = (acc: (coordinates: number[]) => number, us: Vector[]): number[] => us[0].map((_, i, u) => acc(us.map(u => u[i])));;
const are2D = (u: Vector, v: Vector): boolean => is2D(u) && dim(u) === dim(v); 
const is2D = (u: Vector): boolean => 2 === dim(u);
const dot = (u: Vector, v: Vector): number => { 
    return are2D(u, v) 
    ? u[0]*v[0] + u[1]*v[1]
    : zip(cs => cs.reduce((acc, c) => acc * c, 1), [u, v])
        .reduce((acc, n) => acc + n, 0);
}    
const norm = (u: Vector): number => Math.sqrt(normSqr(u));
const normSqr = (u: Vector): number => dot(u, u);
const normalize = (u: Vector): Vector => scale(1/norm(u), u);
const scale = (k: number, u: Vector): Vector => is2D(u) ? [k*u[0], k*u[1]]: u.map(x => k * x);
const subtract = (u: Vector, v: Vector): Vector => are2D(u, v) 
    ? [u[0]-v[0], u[1]-v[1]]
    : zip((cs) => cs.slice(1).reduce((acc, c) => acc - c, cs[0]), [u, v]);

const add = (u: Vector, v: Vector): Vector => are2D(u, v) 
    ? [u[0]+v[0], u[1]+v[1]]
    : zip((cs) => cs.reduce((acc, c) => acc + c, 0), [u, v]);
const areOrthogonal = (u: Vector, v: Vector): boolean => dot(u, v) === 0;
const distance = (u: Vector, v: Vector): number => norm(subtract(u, v));
const angleBetween = (u: Vector, v: Vector): number => Math.atan2(cross(u, v), dot(u, v)); 
const proj = (u: Vector, v: Vector): Vector => scale(dot(u, v) / dot(v, v), v);
const rotate = (angle: number, u: Vector): Vector => [...math.multiply(createRotation(angle), u) as any as number[]]
const cross = (u: Vector, v: Vector): number => {
    if (2 == dim(u) && dim(u) == dim(v)) { return getX(u) * getY(v) - getY(u) * getX(v); }
    throw new Error('not yet implemented');
}
const perpendicular = (u: Vector): Vector => [-getY(u), getX(u)];
const copyIn = (u: Vector, v: Vector): Vector => {
    if (are2D(u, v))
    {
        u[0] = v[0];
        u[1] = v[1];
    }
    else throw new Error('not yet implemented');    
    return u;
}

export {getX, getY, dot, dim, norm, normSqr, normalize, scale, subtract, add, areOrthogonal, distance, angleBetween, proj, rotate, cross, perpendicular, copyIn};

const createRotation = (angle: number) => [
    [Math.cos(angle), -1 * Math.sin(angle)],
    [Math.sin(angle), Math.cos(angle)]
];
