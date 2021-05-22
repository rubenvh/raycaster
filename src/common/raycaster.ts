import { intersectRay } from "./geometry/bsp/querying";
import { IntersectionStats, intersectRayPolygons, IRay, lookupMaterialFor, RayCollisions, RayHit } from "./geometry/collision";
import { IGeometry } from "./geometry/geometry";
import { isTranslucent } from "./geometry/properties";

export type CastingStats = {polygons: Set<String>, edgeTests: [number, number], polygonTests: [number, number], edgeCount: number, polygonCount: number, edgePercentage: number};
export const EMPTY_STATS: CastingStats = {polygons: new Set<String>(), edgeTests: [+Infinity, -Infinity], polygonTests: [+Infinity, -Infinity], polygonCount: 0, edgeCount: 0, edgePercentage: 0};
export type CastedRays = {castedRays: CastedRay[], stats: CastingStats };
export type CastedRay = {hits: RayHit[], stats: IntersectionStats};
const makeInfinity = (ray: IRay, stats: IntersectionStats): CastedRay => ({
    hits: [{ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY}],
    stats
});

export const castCameraRay = (ray: IRay, geometry: IGeometry): RayHit =>  {
    const stopOnImpassableEdge: (hit: RayHit)=> boolean = hit => !hit.edge.immaterial;
    return castRays([ray], geometry, passThroughImmaterialEdges, stopOnImpassableEdge).castedRays[0].hits[0];    
}
export const castCollisionRays = (rays: IRay[], geometry: IGeometry): CastedRays => {    
    const stopOnNonTranslucentEdge: (hit: RayHit)=>boolean = hit => !isTranslucent(hit.intersection.face, hit.edge.material);
    return castRays(rays, geometry, passTroughTranslucentEdges, stopOnNonTranslucentEdge);
}

/**
 * A filter function for ray hits where only material edges are kept. Can be used for collision 
 * detection for blocking an actor's movement .
 * @param hits The collection of actual ray hits
 * @returns a collection of ray hits where immaterial edges are filtered out
 */
const passThroughImmaterialEdges: (hits: RayHit[])=>RayHit[] = hits => hits.filter(_=>!_.edge.immaterial);

/**
 * A filter function for ray hits where hits are kept until the first non-translucent edge. 
 * @param hits The collection of actual ray hits
 * @returns a collection of ray hits for translucent edges and the first solid edge in the collection
 */
const passTroughTranslucentEdges: (hits: RayHit[])=>RayHit[] = hits => {    
    let i = 0;    
    while (i < hits.length && isTranslucentEdge(hits[i++]));      
    return hits.slice(0, i);
};

const castRays = (rays: IRay[], geometry: IGeometry, 
    hitFilter: (hits: RayHit[])=>RayHit[],
    earlyExitPredicate: (hit: RayHit)=>boolean): CastedRays => {    
    if (!hitFilter) { hitFilter = x => x.slice(0,1);}
    let stats = {...EMPTY_STATS, polygons: new Set<String>()};
    const castedRays = rays
        .map(_ => {
            const collisions = detectCollisions(_, geometry, earlyExitPredicate);                                                
            const hits = collisions.hits
                .filter(needsRendering)
                .sort((a,b)=> a.distance - b.distance);
                
            const result = hitFilter(hits);  

            stats = accumulateStats(stats, collisions.stats);

            if (!result || result.length < 1) { return makeInfinity(_, collisions.stats); }                                    
            return { stats: collisions.stats, hits: result };
        });

    return ({castedRays, stats});
};

const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): CastingStats => {
    iStats.polygons.forEach(x => stats.polygons.add(x));
    return ({
        polygons: stats.polygons,
        edgeTests: [Math.min(stats.edgeTests[0], iStats.testedEdges), Math.max(stats.edgeTests[1], iStats.testedEdges)],
        polygonTests: [Math.min(stats.polygonTests[0], iStats.testedPolygons), Math.max(stats.polygonTests[1], iStats.testedPolygons)],
        edgeCount: Math.max(stats.edgeCount, iStats.totalEdges),
        polygonCount: Math.max(stats.polygonCount, iStats.totalPolygons),
        edgePercentage: iStats.totalEdges !== 0 ? Math.max(stats.edgePercentage, iStats.testedEdges/iStats.totalEdges): stats.edgePercentage
    });
}

const detectCollisions = (ray: IRay, geometry: IGeometry, earlyExitPredicate: (hit: RayHit)=>boolean): RayCollisions  => {
    const result: RayCollisions = {ray, stats: {testedEdges: 0, totalEdges: geometry.edgeCount, totalPolygons: geometry.polygons.length, testedPolygons: 0, polygons: new Set<string>()}, hits: []};
        const polygonIntersections = geometry.bsp 
        ? intersectRay(geometry.bsp, ray, earlyExitPredicate)
        : intersectRayPolygons(geometry.polygons, ray, earlyExitPredicate);

    result.hits = polygonIntersections.hits;
    result.stats.testedEdges = polygonIntersections.edgeCount;
    result.stats.testedPolygons = polygonIntersections.polygonCount;
    result.stats.polygons = polygonIntersections.polygonIds;
    return result;
};

const isTranslucentEdge = (hit: RayHit): boolean => isTranslucent(hit.intersection.face, hit.edge.material);
const needsRendering = (hit: RayHit): boolean => !!lookupMaterialFor(hit);