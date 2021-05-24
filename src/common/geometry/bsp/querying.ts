import { EMPTY_INTERSECTION, hasIntersect, intersectRayPlane, intersectRayPolygons, intersectRaySegment, IRay, PolygonIntersections, RayHit } from './../collision';
import { IBSPNode, isLeafNode, isSplitNode, PointToPlaneRelation, SplitBspNode } from './model';
import { classifyPointToPlane } from './classification';
import { Face } from '../properties';

export function intersectRay(tree: IBSPNode, ray: IRay, earlyExitPredicate: (hit: RayHit)=>boolean): PolygonIntersections {
    if (isLeafNode(tree)) {
        return intersectRayPolygons(tree.polygons, ray, earlyExitPredicate);
        
    } else if (isSplitNode(tree)) {
        
        const i = intersectRayPlane(ray, tree.plane);       
                
        if (i) {
            return intersectUntilBlocked(tree, ray, i.face, earlyExitPredicate);
        } else {
            let result = intersectRayPolygons(tree.coplanar, ray, earlyExitPredicate);
            const c = classifyPointToPlane(ray.position, tree.plane);
            addIntersections(result, intersectRay(c === PointToPlaneRelation.InFront ? tree.front : tree.back, ray, earlyExitPredicate));
            return result;
        }
    }
    return EMPTY_INTERSECTION;    
}

export function intersectUntilBlocked(tree: SplitBspNode, ray: IRay, face: Face, earlyExitPredicate: (hit: RayHit)=>boolean): PolygonIntersections {
    const [closest, farthest] = face === Face.interior ? [tree.back, tree.front] : [tree.front, tree.back];
    
    let result = intersectRay(closest, ray, earlyExitPredicate);    
    if (result.stop) return result;

    addIntersections(result, intersectRayPolygons(tree.coplanar, ray, earlyExitPredicate));
    if (result.stop) return result;

    // let result = intersectRayPolygons(tree.coplanar, ray, earlyExitPredicate);    
    // if (result.stop) return result;

    // addIntersections(result, intersectRay(closest, ray, earlyExitPredicate));
    // if (result.stop) return result;
    
    addIntersections(result, intersectRay(farthest, ray, earlyExitPredicate));
    return result;
}

const addIntersections = (target: PolygonIntersections, source: PolygonIntersections): PolygonIntersections => {
    target.hits.push(...source.hits);    
    source.polygonIds.forEach(_ => target.polygonIds.add(_));
    target.edgeCount += source.edgeCount;
    target.polygonCount += source.polygonCount;
    target.stop = target.stop || source.stop;
    return target;
};
