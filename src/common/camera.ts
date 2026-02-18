import * as vector from './math/vector';
import { ILine, ILineSegment, lineAngle } from "./math/lineSegment";
import { castCameraRay } from './rendering/raycasting/raycaster';
import { IGeometry } from './geometry/geometry';
import { intersectRaySegment, IRay, makeRay, makeRayWithCos } from './geometry/collision';
import { createPlane, Plane } from './math/plane';
import { cloneEdge, clipEdgeLightweight, IEdge, NULL_EDGE } from './geometry/edge';
import { classifyPointToPlane } from './geometry/bsp/classification';
import { PointToPlaneRelation } from './geometry/bsp/model';

type ICameraData = { position: vector.Vector, direction: vector.Vector, plane?: vector.Vector };
export type ICamera = ICameraData & {
    screen: ILineSegment,
    midline: ILineSegment,
    cone: { left: IRay, right: IRay },
    planes: { camera: Plane, left: Plane, right: Plane },
    directionNorm: number
};

const makeScreen = (data: ICameraData): ILineSegment => {
    let plane = data.plane || vector.perpendicular(data.direction);
    let mid = vector.add(data.position, data.direction);
    return [vector.subtract(mid, plane), vector.add(mid, plane)];
};
const makeCameraRay = (factor: number, camera: ICameraData, midline: ILineSegment) => {
    let rayDir = vector.add(camera.direction, vector.scale(factor, camera.plane));
    // Fused atan2+cos: instead of cos(atan2(cross(u,v), dot(u,v))),
    // use identity cos(atan2(y,x)) = x / sqrt(x^2 + y^2)
    // where u = midline direction, v = ray direction
    const mx = midline[1][0] - midline[0][0];
    const my = midline[1][1] - midline[0][1];
    const d = mx * rayDir[0] + my * rayDir[1];  // dot(midDir, rayDir)
    const c = mx * rayDir[1] - my * rayDir[0];  // cross(midDir, rayDir)
    const cosAngle = d / Math.sqrt(d * d + c * c);
    return makeRayWithCos(camera.position, rayDir, cosAngle);
};
export const makeCamera = (data: ICameraData): ICamera => {
    const midline: ILineSegment = [data.position, vector.add(data.position, data.direction)]
    const cone = [makeCameraRay(-1, data, midline), makeCameraRay(1, data, midline)];
    let p1 = createPlane(cone[0].line);
    let p2 = createPlane(cone[1].line);
    let cameraPlane = createPlane([vector.subtract(data.position, data.plane), vector.add(data.position, data.plane)]);
    return ({
        ...data,
        screen: makeScreen(data),
        midline,
        cone: { left: cone[0], right: cone[1] },
        planes: { camera: cameraPlane, left: p1, right: p2 },
        directionNorm: vector.norm(data.direction)
    });
}

export const DEFAULT_CAMERA: ICamera = makeCamera({ position: [50, 50], direction: [0, 10], plane: [15, 0] });

export const adaptAngle = (direction: 0 | 1 | -1, camera: ICamera): ICamera => {
    let delta = vector.scale(direction * 0.05, camera.plane); // TODO: magic constant
    return makeCamera(({ ...camera, plane: vector.add(camera.plane, delta) }));
};
export const adaptDepth = (direction: 1 | -1, camera: ICamera): ICamera => {
    let delta = vector.scale(direction * 0.01, camera.direction);
    return makeCamera(({ ...camera, direction: vector.add(camera.direction, delta) }));
};

export const freeMove = (ratio: number, camera: ICamera) => {
    let delta = vector.scale(ratio, camera.direction);
    return changeLocation(delta, camera);
};
export const move = (direction: 1 | -1, camera: ICamera, geometry: IGeometry, speed: number = 0.15): ICamera =>
    constrainedMove(direction, camera, freeMove, makeDirectionRay, geometry, speed);

export const rotate = (angle: number, camera: ICamera) => {
    return makeCamera({
        ...camera,
        direction: vector.rotate(angle, camera.direction),
        plane: vector.rotate(angle, camera.plane),
    });
};
export const freeStrafe = (ratio: number, camera: ICamera) => {
    // Use perpendicular instead of rotate(±PI/2) to avoid trig calls
    // rotate(+PI/2, [x,y]) = [-y, x], rotate(-PI/2, [x,y]) = [y, -x]
    const dir = camera.direction;
    const perp: vector.Vector = ratio > 0 ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
    let n = vector.scale(Math.abs(ratio), perp);
    return changeLocation(n, camera);
};
export const strafe = (direction: 1 | -1, camera: ICamera, geometry: IGeometry, speed: number = 0.15): ICamera =>
    constrainedMove(direction, camera, freeStrafe, makeStrafeRay, geometry, speed);

const changeLocation = (delta: vector.Vector, camera: ICamera): ICamera => {
    return makeCamera({ ...camera, position: vector.add(camera.position, delta) });
}

const MAX_WALL_SLIDE_ITERATIONS = 3;
const SAFE_DISTANCE_FACTOR = 1.5;

const constrainedMove = (direction: 1 | -1, cam: ICamera,
    mover: (ratio: number, cam: ICamera) => ICamera,
    raymaker: (direction: 1 | -1, cam: ICamera) => IRay,
    geometry: IGeometry,
    speed: number): ICamera => {

    let currentMover = mover;
    let currentRaymaker = raymaker;

    for (let iteration = 0; iteration < MAX_WALL_SLIDE_ITERATIONS; iteration++) {
        let movementRatio = direction * speed;
        const hit = castCameraRay(currentRaymaker(direction, cam), geometry);
        const stepSize = Math.abs(speed) * cam.directionNorm;
        const safeDistance = stepSize * SAFE_DISTANCE_FACTOR;
        if (hit.distance >= safeDistance) {
            // distance large enough: safe to move
            return currentMover(movementRatio, cam);
        }

        // calculate angle with collided edge
        const s = hit.edge.segment;
        const collisionAngle = Math.abs(lineAngle(s, hit.ray.line)) - Math.PI / 2;

        // if angle is small enough, stop movement by returning original camera
        if (Math.abs(collisionAngle) <= Math.PI / 8) return cam;

        // angle is large enough, move parallel to collided edge
        // scale slide speed by sin(collisionAngle): collisionAngle is measured from the wall normal,
        // so sin gives the parallel component — full speed at glancing angles, slow near the stop threshold
        const slideFactor = Math.abs(Math.sin(collisionAngle));
        movementRatio = Math.abs(movementRatio) * cam.directionNorm * slideFactor;
        const edgeDirection = collisionAngle < 0 ? vector.subtract(s[1], s[0]) : vector.subtract(s[0], s[1]);
        const target = vector.scale(movementRatio, vector.normalize(edgeDirection));

        // set up next iteration to check wall-slide direction for further collisions (e.g. corners)
        currentMover = (_r, c) => changeLocation(target, c);
        currentRaymaker = (_d, c) => makeRay(c.position, target);
    }

    // exceeded max iterations (e.g. stuck in a tight corner): stay in place
    return cam;
}



export const makeRays = (resolution: number, camera: ICamera): IRay[] => {
    const result = [];
    for (let x: number = 0; x <= resolution; x++) {
        let factor = 2 * x / resolution - 1;
        result.push(makeCameraRay(factor, camera, camera.midline));
    }
    return result;
};

export const clip = (e: IEdge, camera: ICamera): IEdge => {
    let sh = classifyPointToPlane(e.start.vector, camera.planes.camera);
    let eh = classifyPointToPlane(e.end.vector, camera.planes.camera);
    if (sh === PointToPlaneRelation.InFront || eh === PointToPlaneRelation.InFront) {
        let [sl, sr, el, er] = [
            classifyPointToPlane(e.start.vector, camera.planes.left),
            classifyPointToPlane(e.start.vector, camera.planes.right),
            classifyPointToPlane(e.end.vector, camera.planes.left),
            classifyPointToPlane(e.end.vector, camera.planes.right)];
        
        let outsideView = sl === sr && el === er && sl === el;
        if (outsideView) { return NULL_EDGE; }

        let clipBoth = sl === sr && el === er && sl !== el; // completely crossing view (need clipping)
        let clipStart = sh !== PointToPlaneRelation.InFront || clipBoth || sl === sr && el !== er;
        let clipEnd = eh !== PointToPlaneRelation.InFront || clipBoth || sl !== sr && el === er;

        return clipEdgeLightweight(e,
            clipStart ? intersectRaySegment(camera.cone.left, e.segment)?.point ?? intersectRaySegment(camera.cone.right, e.segment)?.point : null,
            clipEnd ? intersectRaySegment(camera.cone.right, e.segment)?.point ?? intersectRaySegment(camera.cone.left, e.segment)?.point : null);
    }
    return NULL_EDGE;
}

// TODO: move this to camera module
export const isInView = (e: IEdge, camera: ICamera): boolean => {
    if (classifyPointToPlane(e.start.vector, camera.planes.camera) === PointToPlaneRelation.InFront
        || classifyPointToPlane(e.end.vector, camera.planes.camera) === PointToPlaneRelation.InFront) {
        let [c1, c2, c3, c4] = [
            classifyPointToPlane(e.start.vector, camera.planes.left),
            classifyPointToPlane(e.start.vector, camera.planes.right),
            classifyPointToPlane(e.end.vector, camera.planes.left),
            classifyPointToPlane(e.end.vector, camera.planes.right)];

        return (c1 === c2 && c3 === c4 && c1 !== c3 || c1 !== c2 || c3 !== c4)
    }
    return false;
}



const makeDirectionRay = (direction: 1 | -1, camera: ICamera): IRay => direction === 1
    ? makeRay(camera.position, camera.direction)
    : makeRay(camera.position, vector.scale(-1, camera.direction));
const makeStrafeRay = (direction: 1 | -1, camera: ICamera): IRay => direction === 1
    ? makeRay(camera.position, vector.scale(-1, camera.plane))
    : makeRay(camera.position, camera.plane);
