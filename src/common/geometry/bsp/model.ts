import { Plane } from '../../math/plane';
import { IPolygon } from './../polygon';

export type NullBspNode = {};
export type LeafBspNode = {polygons: IPolygon[]};
export type BSPNode = {front: IBSPNode, back: IBSPNode, plane: Plane};
export type IBSPNode = BSPNode | LeafBspNode | NullBspNode;
export const NULL_NODE: NullBspNode = {};
export function createLeaf(p: IPolygon[]): IBSPNode { 
    return ({polygons: p});
}
export function createNode(plane: Plane, front: IBSPNode, back: IBSPNode): IBSPNode { 
    return ({front, back, plane});
}

export enum PointToPlaneRelation {
    InFront,
    Behind,
    On
};

export enum PolygonToPlaneRelation {
    InFront,
    Behind,
    Straddling,
    Coplanar
};
