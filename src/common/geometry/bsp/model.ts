import { Plane } from '../../math/plane';
import { IPolygon } from './../polygon';

export type NullBspNode = {type: 'null', count: 0};
export type LeafBspNode = {type: 'leaf', polygons: IPolygon[], count: number};
export type SplitBspNode = {type: 'split', front: IBSPNode, back: IBSPNode, plane: Plane, coplanar: IPolygon[], count: number};
export type IBSPNode = SplitBspNode | LeafBspNode | NullBspNode;
export const NULL_NODE: NullBspNode = {type: 'null', count: 0};
export function createLeaf(p: IPolygon[]): IBSPNode { 
    return ({type: 'leaf', polygons: p, count: p.length});
}
export function createNode(plane: Plane, front: IBSPNode, back: IBSPNode, coplanar: IPolygon[]): IBSPNode { 
    return ({type: 'split', front, back, plane, coplanar, count: front.count + back.count + coplanar.length});
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
