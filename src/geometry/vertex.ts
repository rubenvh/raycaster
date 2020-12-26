import * as vector from '../math/vector';
import { IEntity, giveIdentity } from './entity';

export type IVertex = IEntity & { vector: vector.Vector };

export const makeVertex = (v: vector.Vector): IVertex => ({vector: v});
const isVertex = (v: IVertex|vector.Vector): v is IVertex => (v as IVertex).vector !== undefined;    
const getVector = (vertexOrVector: IVertex|vector.Vector): vector.Vector => isVertex(vertexOrVector) ? vertexOrVector.vector : vertexOrVector;
export const distance = (vertex: IVertex|vector.Vector, v: IVertex|vector.Vector): number => vector.distance(getVector(vertex), getVector(v));
export const areEqual = (u: IVertex, v: IVertex) => u && v && u.vector.length === v.vector.length && u.vector.every((x, i) => x === v.vector[i]);
export const areClose = (vertex: IVertex|vector.Vector, v: IVertex|vector.Vector, epsilon: number = 0.005): boolean => { // TODO: magic constant
    let d = distance(vertex, v);
    return d <= epsilon; 
}
export const duplicateVertex = (v: IVertex, delta?: vector.Vector): IVertex => {
    const clone: vector.Vector = [vector.getX(v.vector), vector.getY(v.vector)];
    return giveIdentity<IVertex>({vector: (delta) ? vector.add(delta, clone) : clone});
}
export const cloneVertex = (v: IVertex): IVertex => ({vector: [vector.getX(v.vector), vector.getY(v.vector)], id: v.id});

    





