import { detectCollisions, RayHit } from './geometry/geometry';
import { IRay } from './geometry/lineSegment';
import { IEdge, IGeometry } from './geometry/vertex';

export type CastedRay = {hits: RayHit[], intersectionFactor: number};
const makeInfinity = (ray: IRay): CastedRay => ({
    hits: [{ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY}],
    intersectionFactor: 0
});

export const passTroughTranslucentEdges: (hits: RayHit[])=>RayHit[] = hits => {
    // return all translucent edges && the first solid edge closest to the camera
    let i = 0;
    while (i < hits.length && isTranslucentEdge(hits[i++].edge));            
    return hits.slice(0, i);
};

export const castRays = (rays: IRay[], geometry: IGeometry, hitFilter: (hits: RayHit[])=>RayHit[] = null): CastedRay[] => {    
    return rays
        .map(_ => {
            const collisions = detectCollisions(_, geometry);
            if (!collisions.hits || collisions.hits.length < 1) { return makeInfinity(_); }
                        
            const result = collisions.hits.sort((a,b)=> a.distance - b.distance);
                        
            return {
                intersectionFactor: collisions.intersectionFactor,
                hits: hitFilter ? hitFilter(result) : result.slice(0,1)};
        });
};

const isTranslucentEdge = (e: IEdge) => e.material?.color[3] < 1;
