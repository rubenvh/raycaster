import { create, all } from 'mathjs'

const config = { }
export const math = create(all, config)

export type Vector = [number, number];

const getX = (u: Vector): number => u[0];
const getY = (u: Vector): number => u[1];
const dim = (u: Vector): number => u.length;
const dot = (u: Vector, v: Vector): number => u[0]*v[0] + u[1]*v[1];
const norm = (u: Vector): number => Math.sqrt(normSqr(u));
const normSqr = (u: Vector): number => dot(u, u);
const normalize = (u: Vector): Vector => scale(1/norm(u), u);
const scale = (k: number, u: Vector): Vector => [k*u[0], k*u[1]];
const subtract = (u: Vector, v: Vector): Vector => [u[0]-v[0], u[1]-v[1]];

const add = (u: Vector, v: Vector): Vector => [u[0]+v[0], u[1]+v[1]];
const areOrthogonal = (u: Vector, v: Vector): boolean => dot(u, v) === 0;
const distance = (u: Vector, v: Vector): number => norm(subtract(u, v));
const angleBetween = (u: Vector, v: Vector): number => Math.atan2(cross(u, v), dot(u, v)); 
const proj = (u: Vector, v: Vector): Vector => scale(dot(u, v) / dot(v, v), v);
const rotate = (angle: number, u: Vector): Vector => [...math.multiply(createRotation(angle), u) as any as [number, number]]
const cross = (u: Vector, v: Vector): number => getX(u) * getY(v) - getY(u) * getX(v);
const perpendicular = (u: Vector): Vector => [-getY(u), getX(u)];
const copyIn = (u: Vector, v: Vector): Vector => {    
    u[0] = v[0];
    u[1] = v[1];    
    return u;
}
const roundToGrid = (value: number) => Math.round(value / 20) * 20; // TODO centralize constants
const snap = (u: Vector, ): Vector => [roundToGrid(u[0]), roundToGrid(u[1])];

export {getX, getY, dot, dim, norm, normSqr, normalize, scale, subtract, add, areOrthogonal, distance, angleBetween, proj, rotate, cross, perpendicular, copyIn, snap};

const createRotation = (angle: number) => [
    [Math.cos(angle), -1 * Math.sin(angle)],
    [Math.sin(angle), Math.cos(angle)]
];
