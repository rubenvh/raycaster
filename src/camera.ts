import * as vector from './vector';
import { ILine, ILineSegment, lineAngle } from "./lineSegment";

export type ICameraData = { position: vector.Vector, direction: vector.Vector, plane?: vector.Vector};
export type ICamera = ICameraData & { screen: ILineSegment};
export type IRay = {line: ILine, angle: number}

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

export const move = (ratio: number, camera: ICamera) => {
    let delta = vector.scale(ratio, camera.direction);
    return makeCamera({...camera, 
        position: vector.add(camera.position, delta),        
    });
};
export const rotate = (angle: number, camera: ICamera) => {  
    return makeCamera({...camera,
        direction: vector.rotate(angle, camera.direction),
        plane: vector.rotate(angle, camera.plane),
    });    
};
export const strafe = (ratio: number, camera: ICamera) => {        
    let sign = ratio > 0 ? 1 : -1;
    let n = vector.scale(Math.abs(ratio), vector.rotate(sign * Math.PI/2, camera.direction));
    return makeCamera({...camera, position: vector.add(camera.position, n) });    
};

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

export const makeDirectionRay = (direction: 1|-1, camera: ICamera): IRay => direction === 1 
    ? ({line: [camera.position, vector.add(camera.position, camera.direction)], angle: 0}) 
    : ({line: [camera.position, vector.subtract(camera.position, camera.direction)], angle: 0});
export const makeStrafeRay = (direction: 1|-1, camera: ICamera): IRay => direction === 1 
    ? ({line: [camera.position, vector.subtract(camera.position, camera.plane)], angle: 0})
    : ({line: [camera.position, vector.add(camera.position, camera.plane)], angle: 0});
