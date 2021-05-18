import { Plane } from '../../math/plane';
import { IPolygon } from './../polygon';

export type NullBspNode = {type: 'null'};
export type LeafBspNode = {type: 'leaf', polygons: IPolygon[]};
export type SplitBspNode = {type: 'split', front: IBSPNode, back: IBSPNode, plane: Plane, coplanar: IPolygon[]};
export type IBSPNode = SplitBspNode | LeafBspNode | NullBspNode;
export const NULL_NODE: NullBspNode = {type: 'null'};
export function createLeaf(p: IPolygon[]): IBSPNode { 
    return ({type: 'leaf', polygons: p});
}
export function createNode(plane: Plane, front: IBSPNode, back: IBSPNode, coplanar: IPolygon[]): IBSPNode { 
    return ({type: 'split', front, back, plane, coplanar});
}
export const isSplitNode = (_: IBSPNode): _ is SplitBspNode => _?.type === 'split';
export const isLeafNode = (_: IBSPNode): _ is LeafBspNode => _?.type === 'leaf';

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
