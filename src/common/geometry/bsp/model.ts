import { Plane } from '../../math/plane';
import { BoundingBox, IPolygon, merge } from './../polygon';
import { maximumComponents, minimumComponents } from '../../math/vector';

export type NullBspNode = {type: 'null', count: 0, bounds: null};
export type LeafBspNode = {type: 'leaf', polygons: IPolygon[], count: number, bounds: BoundingBox};
export type SplitBspNode = {type: 'split', front: IBSPNode, back: IBSPNode, plane: Plane, coplanar: IPolygon[], count: number, bounds: BoundingBox};
export type IBSPNode = SplitBspNode | LeafBspNode | NullBspNode;
export const NULL_NODE: NullBspNode = {type: 'null', count: 0, bounds: null};
export function createLeaf(p: IPolygon[]): IBSPNode { 
    const bounds = computePolygonsBounds(p);
    return ({type: 'leaf', polygons: p, count: p.length, bounds});
}
export function createNode(plane: Plane, front: IBSPNode, back: IBSPNode, coplanar: IPolygon[]): IBSPNode { 
    const bounds = mergeNodeBounds(front, back, coplanar);
    return ({type: 'split', front, back, plane, coplanar, count: front.count + back.count + coplanar.length, bounds});
}

/** Compute the AABB for a list of polygons */
function computePolygonsBounds(polygons: IPolygon[]): BoundingBox {
    if (polygons.length === 0) return [[Infinity, Infinity], [-Infinity, -Infinity]];
    let min = polygons[0].boundingBox[0];
    let max = polygons[0].boundingBox[1];
    for (let i = 1; i < polygons.length; i++) {
        min = minimumComponents(min, polygons[i].boundingBox[0]);
        max = maximumComponents(max, polygons[i].boundingBox[1]);
    }
    return [min, max];
}

/** Merge bounds from child nodes and coplanar polygons. */
function mergeNodeBounds(front: IBSPNode, back: IBSPNode, coplanar: IPolygon[]): BoundingBox {
    const coplanarBounds = computePolygonsBounds(coplanar);
    let result = coplanarBounds;
    if (front.bounds) result = merge(result, front.bounds);
    if (back.bounds) result = merge(result, back.bounds);
    return result;
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
