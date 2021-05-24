import { createLeaf, createNode, IBSPNode, NULL_NODE, PolygonToPlaneRelation } from './model';
import { IPolygon } from './../polygon';
import { oldSplitPolygon, pickSplittingPlane, splitPolygon } from './splitting';
import { classifyPolygonToPlane } from './classification';

//const MAX_DEPTH = 10;
const MIN_LEAF_SIZE = 1;
export function buildBspTree(polygons: IPolygon[], depth: number = 0, maxDepth = Math.ceil(Math.log2(polygons.length))): IBSPNode {
    
    if (depth === 0) { console.log("automatic depth: ", Math.log2(polygons.length)); }
    if (polygons.length === null) return NULL_NODE;

    if (depth >= maxDepth || polygons.length <= MIN_LEAF_SIZE) {
        return createLeaf(polygons);
    }

    const splitPlane = pickSplittingPlane(polygons, depth);
    const frontList: IPolygon[] = [];
    const backList: IPolygon[] = [];
    const coplanarList: IPolygon[] = [];

    for (const polygon of polygons) {
        switch (classifyPolygonToPlane(polygon, splitPlane)) {
            case PolygonToPlaneRelation.Coplanar:
                coplanarList.push(polygon);
                break;
            case PolygonToPlaneRelation.InFront:
                frontList.push(polygon);
                break;
            case PolygonToPlaneRelation.Behind:
                backList.push(polygon);
                break;
            case PolygonToPlaneRelation.Straddling:
                const [front, back] = splitPolygon(polygon, splitPlane);
                frontList.push(front);
                backList.push(back);
                break;
        }        
    }

    const frontTree = buildBspTree(frontList, depth + 1, maxDepth);
    const backTree = buildBspTree(backList, depth + 1, maxDepth);
    return createNode(splitPlane, frontTree, backTree, coplanarList);
}
