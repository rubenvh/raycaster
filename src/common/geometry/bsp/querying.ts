import { createEmptyIntersection, intersectRayPlane, intersectRayPolygons, IRay, PolygonIntersections, RayCastingOptions } from './../collision';
import { IBSPNode, isLeafNode, isSplitNode, PointToPlaneRelation, SplitBspNode } from './model';
import { classifyPointToPlane } from './classification';
import { Face } from '../properties';
import { Vector } from '../../math/vector';
import { IPolygon } from '../polygon';

export function intersectRay(tree: IBSPNode, ray: IRay, options: RayCastingOptions): PolygonIntersections {
    if (isLeafNode(tree)) {
        return intersectRayPolygons(tree.polygons, ray, options);

    } else if (isSplitNode(tree)) {

        const i = intersectRayPlane(ray, tree.plane);
        if (i) {
            return intersectUntilBlocked(tree, ray, i.face, options);
        } else {
            let result = intersectRayPolygons(tree.coplanar, ray, options);
            const c = classifyPointToPlane(ray.position, tree.plane);
            addIntersections(result, intersectRay(c === PointToPlaneRelation.InFront ? tree.front : tree.back, ray, options));
            return result;
        }
    }
    return createEmptyIntersection();
}

export function intersectUntilBlocked(tree: SplitBspNode, ray: IRay, face: Face, options: RayCastingOptions): PolygonIntersections {

    let result = createEmptyIntersection();
    const [closest, farthest] = face === Face.interior
        ? [tree.back, tree.front]
        : [tree.front, tree.back];

    addIntersections(result, intersectRay(closest, ray, options));
    if (result.stop) return result;
    addIntersections(result, intersectRayPolygons(tree.coplanar, ray, options));
    if (result.stop) return result;
    addIntersections(result, intersectRay(farthest, ray, options));
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


export function findClosest(tree: IBSPNode, p: Vector): IBSPNode | undefined {
    if (isLeafNode(tree)) {
        return tree;
    } else if (isSplitNode(tree)) {
        const relation = classifyPointToPlane(p, tree.plane);
        return findClosest(relation === PointToPlaneRelation.InFront ? tree.front : tree.back, p);
    }
    return undefined;
}

export function walk(tree: IBSPNode, p: Vector, map: (polygons: IPolygon[]) => boolean): boolean {
    if (isLeafNode(tree)) {
        return map(tree.polygons);
    } else if (isSplitNode(tree)) {
        let [nearest, farthest] = classifyPointToPlane(p, tree.plane) !== PointToPlaneRelation.Behind ?
            [tree.front, tree.back] : [tree.back, tree.front]

        return walk(nearest, p, map) && map(tree.coplanar) && walk(farthest, p, map);
    }
}
