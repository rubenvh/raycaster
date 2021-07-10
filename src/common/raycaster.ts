import { intersectRay } from "./geometry/bsp/querying";
import { IntersectionStats, intersectRayPolygons, IRay, lookupMaterialFor, RayCastingOptions, RayCollisions, RayHit } from "./geometry/collision";
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
    const options: RayCastingOptions = {
        // stop on closest non-immaterial edge
        earlyExitPredicate: hit => !hit.edge.immaterial,
        // ignore all non-immaterial edges
        edgeFilter: edge => !edge.immaterial
    };
    return castRays([ray], geometry, options).castedRays[0].hits[0];    
}
export const castCollisionRays = (rays: IRay[], geometry: IGeometry): CastedRays => {        
    const options: RayCastingOptions = {
            // stop on closest non-translucent hit
            earlyExitPredicate: hit => !isTranslucent(hit.intersection.face, hit.edge.material),
            // ignore edges without material
            edgeFilter: edge => !!edge.material,
    };
    return castRays(rays, geometry, options);
}

const castRays = (rays: IRay[], geometry: IGeometry,
    options: RayCastingOptions): CastedRays => {        
    let stats = {...EMPTY_STATS, polygons: new Set<String>()};
    const castedRays = rays
        .map(_ => {
            const collisions = detectCollisions(_, geometry, options);
            const result = collisions.hits
                .filter(needsRendering)
                .sort((a,b)=> a.distance - b.distance);
            
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

const detectCollisions = (ray: IRay, geometry: IGeometry, options: RayCastingOptions): RayCollisions  => {
    const totalPolygons = geometry.bsp ? geometry.bsp.count : geometry.polygons.length;
    const result: RayCollisions = {ray, stats: {testedEdges: 0, totalEdges: geometry.edgeCount, totalPolygons, testedPolygons: 0, polygons: new Set<string>()}, hits: []};
        const polygonIntersections = geometry.bsp 
        ? intersectRay(geometry.bsp, ray, options)
        : intersectRayPolygons(geometry.polygons, ray, options);

    result.hits = polygonIntersections.hits;
    result.stats.testedEdges = polygonIntersections.edgeCount;
    result.stats.testedPolygons = polygonIntersections.polygonCount;
    result.stats.polygons = polygonIntersections.polygonIds;
    return result;
};

const needsRendering = (hit: RayHit): boolean => !!lookupMaterialFor(hit);

/**
 * This class can be used to partition rays and send collision queries to a number of web workers.
 * I'm keeping this for reference, but it does not increase speed.
 */
export class PartionedRayCaster {
    private workers: Worker[] = [];
    constructor() {        
        this.workers = Array.from(Array(3).keys()).map(_ => new Worker("../workers/dist/rayCaster-bundle.js"));
    }

    public updateGeometry = (geometry: IGeometry) => {
        this.workers.forEach(w => w.postMessage(geometry));
    }

    private send(worker: Worker, rays: IRay[]): Promise<CastedRays> {
        return new Promise(function(resolve) {            
            worker.postMessage(rays);
            worker.onmessage = function(event){
                resolve(event.data);
            };
        });
    }

    public cast = (rays: IRay[]): Promise<CastedRays> => {
        const chunkSize = Math.ceil(rays.length / this.workers.length);

        let workloads = rays.reduce((memo, value, index) => {            
            if (index % chunkSize == 0 && index !== 0) { memo.push([]); }
            memo[memo.length - 1].push(value);
            return memo
          }, [[]] as IRay[][]);        
        let promises = workloads.map((w, i) => this.send(this.workers[i], w));
        return Promise.all(promises).then(results => results.reduce((acc, cur) => ({castedRays: acc.castedRays.concat(cur.castedRays), stats: cur.stats})));
    }
}