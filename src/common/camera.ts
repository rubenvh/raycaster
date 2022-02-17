import * as vector from './math/vector';
import { ILine, ILineSegment, lineAngle } from "./math/lineSegment";
import { castCameraRay } from './rendering/raycasting/raycaster';
import { IGeometry } from './geometry/geometry';
import { IRay, makeRay } from './geometry/collision';
import { createPlane, Plane } from './math/plane';

type ICameraData = { position: vector.Vector, direction: vector.Vector, plane?: vector.Vector };
export type ICamera = ICameraData & { screen: ILineSegment, midline: ILineSegment, planes: { camera: Plane, left: Plane, right: Plane } };

const makeScreen = (data: ICameraData): ILineSegment => {
    let plane = data.plane || vector.perpendicular(data.direction);
    let mid = vector.add(data.position, data.direction);
    return [vector.subtract(mid, plane), vector.add(mid, plane)];
};
const makeCameraRay = (factor: number, camera: ICameraData, midline: ILineSegment) => {
    let rayDir = vector.add(camera.direction, vector.scale(factor, camera.plane));
    let rayLine = [camera.position, vector.add(camera.position, rayDir)] as ILine;
    return makeRay(camera.position, rayDir, lineAngle(midline, rayLine));
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
        planes: { camera: cameraPlane, left: p1, right: p2 }
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
export const move = (direction: 1 | -1, camera: ICamera, geometry: IGeometry): ICamera =>
    constrainedMove(direction, camera, freeMove, makeDirectionRay, geometry);

export const rotate = (angle: number, camera: ICamera) => {
    return makeCamera({
        ...camera,
        direction: vector.rotate(angle, camera.direction),
        plane: vector.rotate(angle, camera.plane),
    });
};
export const freeStrafe = (ratio: number, camera: ICamera) => {
    let sign = ratio > 0 ? 1 : -1;
    let n = vector.scale(Math.abs(ratio), vector.rotate(sign * Math.PI / 2, camera.direction));
    return changeLocation(n, camera);
};
export const strafe = (direction: 1 | -1, camera: ICamera, geometry: IGeometry): ICamera =>
    constrainedMove(direction, camera, freeStrafe, makeStrafeRay, geometry);

const changeLocation = (delta: vector.Vector, camera: ICamera): ICamera => {
    return makeCamera({ ...camera, position: vector.add(camera.position, delta) });
}

const constrainedMove = (direction: 1 | -1, cam: ICamera,
    mover: (ratio: number, cam: ICamera) => ICamera,
    raymaker: (direction: 1 | -1, cam: ICamera) => IRay,
    geometry: IGeometry): ICamera => {

    let movementRatio = direction * 0.15;
    const hit = castCameraRay(raymaker(direction, cam), geometry);
    if (hit.distance >= 2) { // magic number 2 should actually depend on size of direction/plane vector and 0.15 scale increment above (prevent overshooting the wall)        
        // distance large enough: safe to move
        return mover(movementRatio, cam);
    }

    // calculate angle with collided edge
    const s = hit.edge.segment;
    const collisionAngle = Math.abs(lineAngle(s, hit.ray.line)) - Math.PI / 2;

    // if angle is small enough, stop movement by returning original camera
    if (Math.abs(collisionAngle) <= Math.PI / 8) return cam;

    // angle is large enough, move parallel to collided edge
    // TODO: size of target could depend on angle => faster when angle is further from PI/2
    movementRatio = vector.norm(vector.scale(movementRatio, cam.direction))
    const target = vector.scale(movementRatio, vector.normalize(collisionAngle < 0 ? vector.subtract(s[1], s[0]) : vector.subtract(s[0], s[1])));

    // TODO: recursion => prevent call stack errors
    return constrainedMove(direction, cam,
        (_r, c) => changeLocation(target, c), // move function: change location to calculated target
        (_d, c) => makeRay(c.position, target),// ray creation function: cast ray from camera position to new target
        geometry);
}



export const makeRays = (resolution: number, camera: ICamera): IRay[] => {
    const result = [];
    for (let x: number = 0; x <= resolution; x++) {
        let factor = 2 * x / resolution - 1;
        result.push(makeCameraRay(factor, camera, camera.midline));
    }
    return result;
};



const makeDirectionRay = (direction: 1 | -1, camera: ICamera): IRay => direction === 1
    ? makeRay(camera.position, camera.direction)
    : makeRay(camera.position, vector.scale(-1, camera.direction));
const makeStrafeRay = (direction: 1 | -1, camera: ICamera): IRay => direction === 1
    ? makeRay(camera.position, vector.scale(-1, camera.plane))
    : makeRay(camera.position, camera.plane);
