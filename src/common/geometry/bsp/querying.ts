import { IPolygon } from './../polygon';
import { intersectRayPlane, IRay } from './../collision';
import { IBSPNode, isLeafNode, isSplitNode } from './model';

export function intersectRay(tree: IBSPNode, ray: IRay): IPolygon[] {
    if (isLeafNode(tree)) {
        return tree.polygons;
        
    } else if (isSplitNode(tree)) {
        
        const i = intersectRayPlane(ray, tree.plane);
                
        if (i) {
            return tree.coplanar
                .concat(intersectRay(tree.front, ray))
                .concat(intersectRay(tree.back, ray));
        }
    }
    return [];    
}