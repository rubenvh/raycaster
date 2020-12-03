import { IGeometry, segmentFrom } from './geometry/vertex';
import * as vector from './geometry/vector';
import { ILine, ILineSegment, lineAngle, IRay } from "./geometry/lineSegment";
import { castRays } from './raycaster';

export type ICameraData = { position: vector.Vector, direction: vector.Vector, plane?: vector.Vector};
export type ICamera = ICameraData & { screen: ILineSegment};


const makeScreen = (data: ICameraData): ILineSegment => {
    let plane = data.plane || vector.perpendicular(data.direction);    
    let mid = vector.add(data.position, data.direction);
    return [vector.subtract(mid, plane), vector.add(mid, plane)];
};
export const makeCamera = (data: ICameraData): ICamera => ({...data,    
    screen: makeScreen(data)});

export const adaptAngle = (direction: 0|1|-1, camera: ICamera): ICamera => {
    let delta = vector.scale(direction*0.05, camera.plane); // TODO: magic constant
    return makeCamera(({...camera, plane: vector.add(camera.plane, delta) }));
};
export const adaptDepth = (direction: 1|-1, camera: ICamera): ICamera => {
    let delta = vector.scale(direction*0.01, camera.direction);
    return makeCamera(({...camera, direction: vector.add(camera.direction, delta)}));
};    

export const freeMove = (ratio: number, camera: ICamera) => {
    let delta = vector.scale(ratio, camera.direction);
    return changeLocation(delta, camera);
};
export const move = (direction: 1|-1, camera: ICamera, geometry: IGeometry): ICamera => 
    constrainedMove(direction, camera, freeMove, makeDirectionRay, geometry);

export const rotate = (angle: number, camera: ICamera) => {  
    return makeCamera({...camera,
        direction: vector.rotate(angle, camera.direction),
        plane: vector.rotate(angle, camera.plane),
    });    
};
export const freeStrafe = (ratio: number, camera: ICamera) => {        
    let sign = ratio > 0 ? 1 : -1;
    let n = vector.scale(Math.abs(ratio), vector.rotate(sign * Math.PI/2, camera.direction));
    return changeLocation(n, camera);
};
export const strafe = (direction: 1|-1, camera: ICamera, geometry: IGeometry): ICamera =>
    constrainedMove(direction, camera, freeStrafe, makeStrafeRay, geometry);

const changeLocation = (delta: vector.Vector, camera:ICamera): ICamera  => {
    return makeCamera({...camera, position: vector.add(camera.position, delta) });    
}

const constrainedMove = (direction: 1|-1, cam: ICamera, 
    mover: (ratio: number, cam: ICamera) => ICamera, 
    raymaker: (direction: 1|-1, cam: ICamera)=> IRay,
    geometry: IGeometry): ICamera => {
    
    let movementRatio = direction * 0.15;
    const hit = castRays([raymaker(direction, cam)], geometry)[0].hits[0];    
    if (hit.distance >= 2) { // magic number 2 should actually depend on size of direction/plane vector and 0.15 scale increment above (prevent overshooting the wall)        
        // distance large enough: safe to move
        return mover(movementRatio, cam);
    }

    // calculate angle with collided edge
    const s = segmentFrom(hit.edge);
    const collisionAngle = Math.abs(lineAngle(s, hit.ray.line))-Math.PI/2;

    // if angle is small enough, stop movement by returning original camera
    if (Math.abs(collisionAngle) <= Math.PI/8) return cam;

    // angle is large enough, move parallel to collided edge
    // TODO: size of target could depend on angle => faster when angle is further from PI/2
    movementRatio = vector.norm(vector.scale(movementRatio, cam.direction))
    const target = vector.scale(movementRatio, vector.normalize(collisionAngle < 0 ? vector.subtract(s[1], s[0]) : vector.subtract(s[0], s[1])));
    
    // TODO: recursion => prevent call stack errors
    return constrainedMove(direction, cam,                 
        (_r, c)=> changeLocation(target, c), // move function: change location to calculated target
        (_d, c) => ({angle: 0, line: [c.position, vector.add(c.position, target)]}),// ray creation function: cast ray from camera position to new target
        geometry);     
}

export const makeRays = (resolution: number, camera: ICamera): IRay[] => {    
    const result = [];
    const m: ILineSegment = [camera.position, vector.add(camera.position, camera.direction)];
    for(let x: number = 0; x < resolution; x++)
    {
        let factor = 2 * x / resolution - 1;
        let rayDir = vector.add(camera.direction, vector.scale(factor, camera.plane));
        let rayLine = [camera.position, vector.add(camera.position, rayDir)] as ILine;
        result.push({ line: rayLine, angle: lineAngle(m, rayLine) });
    }
    return result;    
};

const makeDirectionRay = (direction: 1|-1, camera: ICamera): IRay => direction === 1 
    ? ({line: [camera.position, vector.add(camera.position, camera.direction)], angle: 0}) 
    : ({line: [camera.position, vector.subtract(camera.position, camera.direction)], angle: 0});
const makeStrafeRay = (direction: 1|-1, camera: ICamera): IRay => direction === 1 
    ? ({line: [camera.position, vector.subtract(camera.position, camera.plane)], angle: 0})
    : ({line: [camera.position, vector.add(camera.position, camera.plane)], angle: 0});
