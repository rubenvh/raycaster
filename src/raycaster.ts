import { detectCollisions } from './geometry';
import { IGeometry } from './vertex';
import { ICamera, makeRays, distanceTo } from './camera';
import * as vector from './vector';

export type CastedRay = {distance: number, intersection: vector.Vector}
export const getCastedRays = (resolution: number, camera: ICamera, geometry: IGeometry): CastedRay[] => {

    const rays = makeRays(resolution, camera);
    const calculateDistance = (v: vector.Vector) =>
    {   
        return distanceTo(v, camera);        
    };
    return rays
        .map(_ => detectCollisions(_, geometry)
            .map(c => ({ 
                distance: calculateDistance(c.intersection), 
                intersection: c.intersection}))
            .sort((a,b)=> a.distance - b.distance)
            [0]);        
}