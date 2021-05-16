import { createLeaf, createNode, IBSPNode, NULL_NODE, PolygonToPlaneRelation } from './model';
import { IPolygon } from './../polygon';
import { pickSplittingPlane, splitPolygon } from './splitting';
import { classifyPolygonToPlane } from './classification';

const MAX_DEPTH = 5;
const MIN_LEAF_SIZE = 1;
export function buildBspTree(polygons: IPolygon[], depth: number = 0): IBSPNode {
    
    if (polygons.length === null) return NULL_NODE;

    if (depth >= MAX_DEPTH || polygons.length <= MIN_LEAF_SIZE) {
        return createLeaf(polygons);
    }

    const splitPlane = pickSplittingPlane(polygons);
    const frontList: IPolygon[] = [];
    const backList: IPolygon[] = [];

    for (const polygon of polygons) {
        switch (classifyPolygonToPlane(polygon, splitPlane)) {
            case PolygonToPlaneRelation.Coplanar:
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

    const frontTree = buildBspTree(frontList, depth + 1);
    const backTree = buildBspTree(backList, depth + 1);
    return createNode(splitPlane, frontTree, backTree);
}
