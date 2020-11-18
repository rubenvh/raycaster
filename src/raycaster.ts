import { detectCollisions, RayHit } from './geometry';
import { IGeometry } from './vertex';
import { ICamera, makeRays } from './camera';
import * as vector from './vector';

export type CastedRay = {distance: number, hit: RayHit};
export const getCastedRays = (resolution: number, camera: ICamera, geometry: IGeometry): CastedRay[] => {

    const rays = makeRays(resolution, camera);
    const calculateDistance = (hit: RayHit) =>
    {   
        return vector.distance(hit.intersection, camera.location) * Math.cos(hit.ray.angle);
    };
    return rays
        .map(_ => detectCollisions(_, geometry)
            .map(c => ({                 
                distance: calculateDistance(c), 
                hit: c}))
            .sort((a,b)=> a.distance - b.distance)
            [0] || ({distance: Number.POSITIVE_INFINITY, hit: {ray: _, edge: null, intersection: null, polygon: null}}));
}