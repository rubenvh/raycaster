import * as vector from './vector';
import { ILine, ILineSegment, lineAngle } from "./lineSegment";

export type ICameraData = { location: vector.Vector, target: vector.Vector, angle?: number};
export type ICamera = ICameraData & { screen: ILineSegment};
export type IRay = {line: ILine, angle: number}

const makeScreen = (data: ICameraData): ILineSegment => {
    let angle = data.angle || Math.PI/4;
    let d = vector.subtract(data.target, data.location);
    return [
        vector.add(data.location, vector.rotate(angle, d)),
        vector.add(data.location, vector.rotate(-1 * angle, d))
    ];
};
export const makeCamera = (data: ICameraData): ICamera => ({...data,
    angle: data.angle || Math.PI/4,
    screen: makeScreen(data)});
export const adaptAngle = (direction: 0|1|-1, camera: ICamera): ICamera => {
    let newAngle = camera.angle + direction*0.05; // TODO: magic constant
    return makeCamera(({...camera,
        angle: newAngle <= Math.PI/16 ? Math.PI/16 : (newAngle >= (3/8)* Math.PI ? (3/8)*Math.PI : newAngle)
    }));
};
export const adaptDepth = (direction: 1|-1, camera: ICamera): ICamera => {
    let delta = vector.scale(direction*0.01, vector.subtract(camera.target, camera.location));        
    return makeCamera(({...camera, 
        target: vector.add(camera.target, delta)}));
};    

export const move = (ratio: number, camera: ICamera) => {
    let delta = vector.scale(ratio, vector.subtract(camera.target, camera.location));
    return makeCamera({...camera, 
        location: vector.add(camera.location, delta),
        target: vector.add(camera.target, delta)
    });
};
export const rotate = (angle: number, camera: ICamera) => {
    let d = vector.subtract(camera.target, camera.location);
    return makeCamera({...camera,
        target: vector.add(camera.location, vector.rotate(angle, d))
    });    
};
export const strafe = (ratio: number, camera: ICamera) => {    
    let d = vector.subtract(camera.target, camera.location);
    let sign = ratio > 0 ? 1 : -1;
    let n = vector.scale(Math.abs(ratio), vector.rotate(sign * Math.PI/2, d));
    return makeCamera({...camera,
        location: vector.add(camera.location, n),
        target: vector.add(camera.target, n)
    });    
};

export const makeRays = (resolution: number, camera: ICamera): IRay[] => { 
    const base = vector.subtract(camera.screen[1], camera.screen[0]);
    return Array.from(Array(resolution+1).keys())
        .map(i => i/resolution)
        .map(factor => ({
            line: [camera.location, vector.add(camera.screen[0], vector.scale(factor, base))] as ILine,
            }))
        .map(r => ({...r, 
            angle: lineAngle([camera.location, camera.target], r.line)}));
};
