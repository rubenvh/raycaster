import { createLeaf, createNode, IBSPNode, NULL_NODE, PointToPlaneRelation, PolygonToPlaneRelation } from './model';
import { IPolygon, isConvex } from './../polygon';
import { pickSplittingPlane, splitPolygon } from './splitting';
import { classifyPointToPlane, classifyPolygonToPlane } from './classification';
import { isSamePlane, Plane, VOID_PLANE } from '../../math/plane';

const MAX_DEPTH = 50;
const MIN_LEAF_SIZE = 1;

export function buildBspTree(polygons: IPolygon[], depth: number = 0, maxDepth = MAX_DEPTH, previousSplitPlane: Plane = VOID_PLANE): IBSPNode {
    
    if (polygons.length === null) return NULL_NODE;    

    if (polygons.every(p => isConvex(p)) || depth >= maxDepth) {    
        return createLeaf(polygons);
    }


    const splitPlane = pickSplittingPlane(polygons, depth, previousSplitPlane);
    if (isSamePlane(splitPlane, VOID_PLANE)) { return createLeaf(polygons); }

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

                // check if polygons are split correctly:
                if (!front.vertices.map(v => classifyPointToPlane(v.vector, splitPlane)).every(c => c === PointToPlaneRelation.InFront || c === PointToPlaneRelation.On)) { console.log('FRONT: not all vertex in front of plane'); }
                if (!back.vertices.map(v => classifyPointToPlane(v.vector, splitPlane)).every(c => c === PointToPlaneRelation.Behind || c === PointToPlaneRelation.On)) { console.log('BACK: not all vertex in back of plane'); }

                frontList.push(front);
                backList.push(back);
                break;
        }
    }

    const frontTree = buildBspTree(frontList, depth + 1, maxDepth);
    const backTree = buildBspTree(backList, depth + 1, maxDepth);
    return createNode(splitPlane, frontTree, backTree, coplanarList);
}
