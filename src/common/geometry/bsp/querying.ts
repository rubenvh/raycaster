import { createEmptyIntersection, intersectRayPlane, intersectRayPolygons, IRay, PolygonIntersections, RayCastingOptions } from './../collision';
import { IBSPNode, isLeafNode, isSplitNode, PointToPlaneRelation, SplitBspNode } from './model';
import { classifyPointToPlane } from './classification';
import { Face } from '../properties';
import { Vector } from '../../math/vector';
import { BoundingBox, IPolygon } from '../polygon';
import { Plane } from '../../math/plane';

export type FrustumPlanes = { camera: Plane, left: Plane, right: Plane };

/**
 * Tests whether a 2D AABB is entirely behind a half-plane (dot(n,p) < d for all corners).
 * The AABB is fully behind the plane if its p-vertex (the corner most in the direction 
 * of the plane normal) is still behind the plane.
 */
export function isAABBBehindPlane(bounds: BoundingBox, plane: Plane): boolean {
    // Find the "p-vertex": the corner of the AABB most in the direction of the plane normal.
    // For each axis, pick max if normal component is positive, min if negative.
    const px = plane.n[0] >= 0 ? bounds[1][0] : bounds[0][0];
    const py = plane.n[1] >= 0 ? bounds[1][1] : bounds[0][1];
    // Inline dot product to avoid allocating a temporary [px, py] array
    return plane.n[0] * px + plane.n[1] * py < plane.d;
}

/**
 * Tests whether a 2D AABB is entirely in front of a half-plane (dot(n,p) > d for all corners).
 * The AABB is fully in front if its n-vertex (the corner least in the direction of the 
 * plane normal) is still in front of the plane.
 */
export function isAABBInFrontOfPlane(bounds: BoundingBox, plane: Plane): boolean {
    // Find the "n-vertex": the corner of the AABB least in the direction of the plane normal.
    // This is the opposite of the p-vertex: for each axis, pick min if normal is positive, max if negative.
    const nx = plane.n[0] >= 0 ? bounds[0][0] : bounds[1][0];
    const ny = plane.n[1] >= 0 ? bounds[0][1] : bounds[1][1];
    // Inline dot product to avoid allocating a temporary [nx, ny] array
    return plane.n[0] * nx + plane.n[1] * ny > plane.d;
}

/**
 * Tests whether a 2D AABB is entirely outside the camera frustum.
 * The frustum is defined by three planes: camera (near), left, and right.
 * 
 * The camera and right planes have inward-pointing normals (toward the visible area),
 * so "behind" = outside the frustum.
 * 
 * The left plane has an outward-pointing normal (due to createPlane using CCW perpendicular),
 * so "in front" = outside the frustum on the left side.
 */
export function isAABBOutsideFrustum(bounds: BoundingBox, frustum: FrustumPlanes): boolean {
    return isAABBBehindPlane(bounds, frustum.camera)
        || isAABBInFrontOfPlane(bounds, frustum.left)
        || isAABBBehindPlane(bounds, frustum.right);
}

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
    // Use push.apply for efficient array concatenation without spread operator allocation
    if (source.hits.length > 0) {
        Array.prototype.push.apply(target.hits, source.hits);
    }
    // Lazily merge polygon IDs (both sides may be null)
    if (source.polygonIds != null) {
        if (target.polygonIds == null) target.polygonIds = new Set();
        for (const id of source.polygonIds) {
            target.polygonIds.add(id);
        }
    }
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
    // NullBspNode - nothing to traverse, return true to continue chain
    return true;
}

/**
 * Walk the BSP tree with frustum culling. Skips entire subtrees whose bounding box
 * is entirely outside the camera frustum, avoiding expensive per-edge clip tests.
 */
export function walkWithFrustum(tree: IBSPNode, p: Vector, frustum: FrustumPlanes, map: (polygons: IPolygon[]) => boolean): boolean {
    // Cull: if this node's entire bounding box is outside the frustum, skip it
    if (tree.bounds && isAABBOutsideFrustum(tree.bounds, frustum)) {
        return true; // continue traversal of other branches
    }

    if (isLeafNode(tree)) {
        return map(tree.polygons);
    } else if (isSplitNode(tree)) {
        let [nearest, farthest] = classifyPointToPlane(p, tree.plane) !== PointToPlaneRelation.Behind ?
            [tree.front, tree.back] : [tree.back, tree.front]
        
        return walkWithFrustum(nearest, p, frustum, map) 
            && map(tree.coplanar) 
            && walkWithFrustum(farthest, p, frustum, map);
    }
    // NullBspNode - nothing to traverse, return true to continue chain
    return true;
}
