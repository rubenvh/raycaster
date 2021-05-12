export type Vector = [number, number];

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
/**
 * Project a vector onto another vector (u projected on v)
 * @param u vector to project
 * @param v vector to project onto
 */
const proj = (u: Vector, v: Vector): Vector => scale(dot(u, v) / dot(v, v), v);
const rotate = (angle: number, u: Vector): Vector => matMultiply(createRotation(angle), u);
const cross = (u: Vector, v: Vector): number => u[0] * v[1] - u[1] * v[0];
const perpendicular = (u: Vector): Vector => [-u[1], u[0]];
const copyIn = (u: Vector, v: Vector): Vector => {    
    u[0] = v[0];
    u[1] = v[1];    
    return u;
}
const roundToGrid = (value: number) => Math.round(value / 10) * 10; // TODO centralize constants
const snap = (u: Vector, ): Vector => [roundToGrid(u[0]), roundToGrid(u[1])];
const minimumComponents = (u: Vector, v: Vector): Vector => [Math.min(u[0], v[0]), Math.min(u[1], v[1])];
const maximumComponents = (u: Vector, v: Vector): Vector => [Math.max(u[0], v[0]), Math.max(u[1], v[1])];

export {dot, norm, normSqr, normalize, scale, subtract, add, areOrthogonal, distance, angleBetween, proj, rotate, cross, perpendicular, copyIn, snap, minimumComponents, maximumComponents};

const createRotation = (angle: number): [Vector, Vector] => [
    [Math.cos(angle), -1 * Math.sin(angle)],
    [Math.sin(angle), Math.cos(angle)]
];

const matMultiply = (mat: [Vector, Vector], v: Vector): Vector => {
    return [mat[0][0]*v[0] + mat[0][1]*v[1],
            mat[1][0]*v[0] + mat[1][1]*v[1],];
}


