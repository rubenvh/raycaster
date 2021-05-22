import { IPolygon } from './../polygon';
import { hasIntersect, intersectRayPlane, intersectRaySegment, IRay, RayHit } from './../collision';
import { IBSPNode, isLeafNode, isSplitNode, PointToPlaneRelation, SplitBspNode } from './model';
import { classifyPointToPlane } from './classification';
import { distance } from '../vertex';
import { Face, isTranslucent } from '../properties';

export type PolygonIntersections = {hits: RayHit[], stop: boolean, edgeCount: number, polygonCount: number};
const EMPTY_INTERSECTION: PolygonIntersections = {hits: [], stop: false, edgeCount: 0, polygonCount: 0};


export function intersectRay(tree: IBSPNode, ray: IRay): PolygonIntersections {
    if (isLeafNode(tree)) {
        return intersectRayPolygons(tree.polygons, ray);
        
    } else if (isSplitNode(tree)) {
        
        const i = intersectRayPlane(ray, tree.plane);
                
        if (i) {
            return intersectUntilBlocked(tree, ray, i.face);
        } else {
            const c = classifyPointToPlane(ray.position, tree.plane);
            return intersectRay(c === PointToPlaneRelation.InFront ? tree.front : tree.back, ray);
        }
    }
    return EMPTY_INTERSECTION;    
}

export function intersectUntilBlocked(tree: SplitBspNode, ray: IRay, face: Face): PolygonIntersections {
    const [closest, farthest] = face === Face.interior ? [tree.back, tree.front] : [tree.front, tree.back];

    let result = intersectRay(closest, ray);    
    if (result.stop) return result;

    addIntersections(result, intersectRayPolygons(tree.coplanar, ray));
    if (result.stop) return result;
    
    addIntersections(result, intersectRay(farthest, ray));
    return result;
}

const addIntersections = (target: PolygonIntersections, source: PolygonIntersections): PolygonIntersections => {
    target.hits.push(...source.hits);
    target.edgeCount += source.edgeCount;
    target.polygonCount += source.polygonCount;
    target.stop = target.stop || source.stop;
    return target;
};

export function intersectRayPolygons(polygons: IPolygon[], ray: IRay): PolygonIntersections {    
    const result: PolygonIntersections = {hits: [], stop: false, edgeCount: 0, polygonCount: polygons.length};
    for (const polygon of polygons){        
        if (polygon.edgeCount > 5 && !hasIntersect(ray, polygon.boundingBox)) continue;
        for (const edge of polygon.edges) {            
            result.edgeCount += 1;
            const intersection = intersectRaySegment(ray, edge.segment);                                    
            if (intersection) {
                result.stop = result.stop || !isTranslucent(intersection.face, edge.material);
                result.hits.push({polygon, ray, edge, intersection,
                    distance: distance(intersection.point, ray.line[0]) * ray.cosAngle
                })
            }
        }
    }
    return result;
}