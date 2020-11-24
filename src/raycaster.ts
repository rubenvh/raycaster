import { detectCollisions, RayHit } from './geometry';
import { IEdge, IGeometry } from './vertex';
import { ICamera, IRay, makeRays } from './camera';

export type CastedRay = {hits: RayHit[]};
const makeInfinity = (ray: IRay): CastedRay => ({hits: [{ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY}]});
export const getCastedRays = (resolution: number, camera: ICamera, geometry: IGeometry): CastedRay[] => {    
    return castRays(makeRays(resolution, camera), geometry, hits => {
        // return all translucent edges && the first solid edge closest to the camera
        let i = 0;
        while (i < hits.length && isTranslucentEdge(hits[i++].edge));            
        return hits.slice(0, i);
    })
};

export const castRays = (rays: IRay[], geometry: IGeometry, hitFilter: (hits: RayHit[])=>RayHit[] = null): CastedRay[] => {    
    return rays
        .map(_ => {
            const rayHits = detectCollisions(_, geometry);
            if (!rayHits || rayHits.length < 1) { return makeInfinity(_); }
                        
            const result = rayHits.sort((a,b)=> a.distance - b.distance);
                        
            return {hits: hitFilter ? hitFilter(result) : result.slice(0,1)};
        });
};

const isTranslucentEdge = (e: IEdge) => e.material?.color[3] < 1;
