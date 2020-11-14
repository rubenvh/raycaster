import { create, all } from 'mathjs'

const config = { }
export const math = create(all, config)

export type Vector = number[];

const getX = (u: Vector): number => u[0];
const getY = (u: Vector): number => u[1];
const dim = (u: Vector): number => u.length;
const zip = (acc: (coordinates: number[]) => number, us: Vector[]): number[] => us[0].map((_, i, u) => acc(us.map(u => u[i])));;

const dot = (u: Vector, v: Vector): number => 
    zip(cs => cs.reduce((acc, c) => acc * c, 1), [u, v])
    .reduce((acc, n) => acc + n, 0);    
const norm = (u: Vector): number => math.sqrt(dot(u, u));
const scale = (k: number, u: Vector): Vector => u.map(x => k * x);
const subtract = (u: Vector, v: Vector): Vector => zip((cs) => cs.slice(1).reduce((acc, c) => acc - c, cs[0]), [u, v]);
const add = (u: Vector, v: Vector): Vector => zip((cs) => cs.reduce((acc, c) => acc + c, 0), [u, v]);
const areOrthogonal = (u: Vector, v: Vector): boolean => dot(u, v) === 0;
const distance = (u: Vector, v: Vector): number => norm(subtract(u, v));
const angleBetween = (u: Vector, v: Vector): number => math.acos(dot(u, v) / (norm(u) * norm(v)));
const proj = (u: Vector, v: Vector): Vector => scale(dot(u, v) / dot(v, v), v);
const rotate = (angle: number, u: Vector): Vector => [...math.multiply(createRotation(angle), u) as any as number[]]

export {getX, getY, dot, dim, norm, scale, subtract, add, areOrthogonal, distance, angleBetween, proj, rotate};

const createRotation = (angle: number) => [
    [math.cos(angle), -1 * math.sin(angle)],
    [math.sin(angle), math.cos(angle)]
];
