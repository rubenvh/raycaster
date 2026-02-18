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

/** Merge bounds from child nodes and coplanar polygons.
 *  Collects only finite bounds to avoid Infinity sentinel poisoning
 *  (Infinity becomes null after JSON serialization, breaking frustum culling). */
function mergeNodeBounds(front: IBSPNode, back: IBSPNode, coplanar: IPolygon[]): BoundingBox {
    const validBounds: BoundingBox[] = [];
    if (front.bounds) validBounds.push(front.bounds);
    if (back.bounds) validBounds.push(back.bounds);
    for (const p of coplanar) validBounds.push(p.boundingBox);

    if (validBounds.length === 0) return computePolygonsBounds([]);

    let result = validBounds[0];
    for (let i = 1; i < validBounds.length; i++) {
        result = merge(result, validBounds[i]);
    }
    return result;
}
export const isSplitNode = (_: IBSPNode): _ is SplitBspNode => _?.type === 'split';
export const isLeafNode = (_: IBSPNode): _ is LeafBspNode => _?.type === 'leaf';

/** Recompute bounds for an entire BSP tree from leaf polygon data upward.
 *  Fixes corrupted bounds from JSON round-trips where Infinity serializes to null. */
export function recomputeBspBounds(node: IBSPNode): IBSPNode {
    if (node.type === 'null') return node;
    if (node.type === 'leaf') {
        return { ...node, bounds: computePolygonsBounds(node.polygons) };
    }
    // Split node: recompute children first, then merge upward
    const front = recomputeBspBounds(node.front);
    const back = recomputeBspBounds(node.back);
    const bounds = mergeNodeBounds(front as IBSPNode, back as IBSPNode, node.coplanar);
    return { ...node, front, back, bounds };
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
