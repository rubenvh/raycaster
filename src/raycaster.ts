import { detectCollisions, RayHit } from './geometry';
import { IEdge, IGeometry } from './vertex';
import { ICamera, IRay, makeRays } from './camera';

export type CastedRay = {hits: RayHit[]};
const makeInfinity = (ray: IRay): CastedRay => ({hits: [{ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY}]});
export const getCastedRays = (resolution: number, camera: ICamera, geometry: IGeometry): CastedRay[] => {    
    return makeRays(resolution, camera)
        .map(_ => {
            const rayHits = detectCollisions(_, geometry);
            if (!rayHits || rayHits.length < 1) { return makeInfinity(_); }
                        
            const result = rayHits.sort((a,b)=> a.distance - b.distance);

            // return all translucent edges && the first solid edge closest to the camera
            let i = 0;
            while (i < result.length && isTranslucentEdge(result[i++].edge));            
            return {hits: result.slice(0, i)};
        });
};

const isTranslucentEdge = (e: IEdge) => false;
