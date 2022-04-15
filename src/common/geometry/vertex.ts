import * as vector from '../math/vector';
import { IEntity, giveIdentity, IEntityKey } from './entity';

export type IVertex = IEntity & { vector: vector.Vector };
export const NULL_VERTEX: IVertex = {vector: vector.ZERO };
export type IVertexMap = Map<IEntityKey, IVertex[]>;
export const makeVertex = (v: vector.Vector): IVertex => ({vector: v});
const isVertex = (v: IVertex|vector.Vector): v is IVertex => (v as IVertex).vector !== undefined;    
const getVector = (vertexOrVector: IVertex|vector.Vector): vector.Vector => isVertex(vertexOrVector) ? vertexOrVector.vector : vertexOrVector;
export const distance = (vertex: IVertex|vector.Vector, v: IVertex|vector.Vector): number => vector.distance(getVector(vertex), getVector(v));
export const areEqual = (u: IVertex, v: IVertex) => vector.areEqual(u.vector, v.vector);
export const areClose = (vertex: IVertex|vector.Vector, v: IVertex|vector.Vector, epsilon: number = 0.005): boolean => { // TODO: magic constant
    let d = distance(vertex, v);
    return d <= epsilon; 
}
export const duplicateVertex = (v: IVertex, delta?: vector.Vector): IVertex => {
    const clone: vector.Vector = [v.vector[0], v.vector[1]];
    return giveIdentity<IVertex>({vector: (delta) ? vector.add(delta, clone) : clone});
}
export const cloneVertex = (v: IVertex): IVertex => ({vector: [v.vector[0], v.vector[1]], id: v.id});

    





