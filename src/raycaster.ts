import { IGeometry } from './vertex';
import { ICamera, makeRays } from './camera';

export type CastedRay = {}
export const getCastedRays = (resolution: number, camera: ICamera, geometry: IGeometry): CastedRay[] => {

    const rays = makeRays(resolution, camera);

    return rays.map(r => ({}));
}