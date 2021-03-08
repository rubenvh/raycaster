import { IntersectionFace, IntersectionStats, IRay, RayHit } from "./geometry/collision";
import { detectCollisions, IGeometry } from "./geometry/geometry";


export type CastedRay = {hits: RayHit[], stats: IntersectionStats};
const makeInfinity = (ray: IRay): CastedRay => ({
    hits: [{ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY}],
    stats: {percentage: 0, amount: 0}
});

/**
 * A filter function for ray hits where only material edges are kept. Can be used for collision 
 * detection for blocking an actor's movement .
 * @param hits The collection of actual ray hits
 * @returns a collection of ray hits where immaterial edges are filtered out
 */
export const passThroughImmaterialEdges: (hits: RayHit[])=>RayHit[] = hits => hits.filter(_=>!_.edge.immaterial);

/**
 * A filter function for ray hits where hits are kept until the first non-translucent edge. 
 * @param hits The collection of actual ray hits
 * @returns a collection of ray hits for translucent edges and the first solid edge in the collection
 */
export const passTroughTranslucentEdges: (hits: RayHit[])=>RayHit[] = hits => {    
    let i = 0;    
    while (i < hits.length && isTranslucentEdge(hits[i++]));    
    return hits.slice(0, i);
};

export const castRays = (rays: IRay[], geometry: IGeometry, hitFilter: (hits: RayHit[])=>RayHit[] = null): CastedRay[] => {    
    if (!hitFilter) { hitFilter = x => x.slice(0,1);}
    return rays
        .map(_ => {
            const collisions = detectCollisions(_, geometry);                                    
            const result = hitFilter(collisions.hits
                .filter(needsRendering)
                .sort((a,b)=> a.distance - b.distance));

            if (!result || result.length < 1) { return makeInfinity(_); }                                    
            return { stats: collisions.stats, hits: result };
        });
};

// TODO: this should be determined by edge material at intersected face (interior material vs exterior material)
const isTranslucentEdge = (hit: RayHit) => hit.edge.material?.color[3] < 1;

// TODO: check if the edge has dedicated material for the intersected face orientation hit.intersection.face (interior vs exterior)
const needsRendering = (hit: RayHit): boolean => !!hit.edge.material;