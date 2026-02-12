import { intersectRay } from "../../geometry/bsp/querying";
import { IntersectionStats, intersectRayEdge, intersectRayPolygons, IRay, lookupMaterialFor, RayCastingOptions, RayCollisions, RayHit } from "../../geometry/collision";
import { IEdge } from "../../geometry/edge";
import { IGeometry } from "../../geometry/geometry";
import { isTranslucent } from "../../geometry/properties";

export type CastingStats = { polygons: Set<String>, edgeTests: [number, number], polygonTests: [number, number], edgeCount: number, polygonCount: number, edgePercentage: number };
export const EMPTY_STATS: CastingStats = { polygons: new Set<String>(), edgeTests: [+Infinity, -Infinity], polygonTests: [+Infinity, -Infinity], polygonCount: 0, edgeCount: 0, edgePercentage: 0 };
export type CastedRays = { castedRays: CastedRay[], stats: CastingStats };
export type CastedRay = { hits: RayHit[], stats: IntersectionStats };
const makeInfinity = (ray: IRay, stats: IntersectionStats): CastedRay => ({
    hits: [{ ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY }],
    stats
});

export const castCameraRay = (ray: IRay, geometry: IGeometry): RayHit => {
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
    let stats = { ...EMPTY_STATS, polygons: new Set<String>() };
    let castedRays: CastedRay[] = [];
    for (let i = 0, n = rays.length; i < n; i++) {
        const _ = rays[i];
        const collisions = detectCollisions(_, geometry, options);

        // Single-pass filter and insert in sorted order
        // This avoids creating an intermediate filtered array and then sorting
        const result = filterAndSortHits(collisions.hits);

        stats = accumulateStats(stats, collisions.stats);

        castedRays.push((!result || result.length < 1)
            ? makeInfinity(_, collisions.stats)
            : { stats: collisions.stats, hits: result });
    }
    return ({ castedRays, stats });
};

/**
 * Single-pass filter and sort: filters hits that need rendering and inserts them in sorted order.
 * Avoids creating intermediate arrays from .filter().sort() chain.
 */
const filterAndSortHits = (hits: RayHit[]): RayHit[] => {
    const result: RayHit[] = [];
    for (let i = 0, n = hits.length; i < n; i++) {
        const hit = hits[i];
        if (!needsRendering(hit)) continue;
        
        // Binary search to find insertion point for sorted order
        let lo = 0;
        let hi = result.length;
        const dist = hit.distance;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (result[mid].distance < dist) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        // Insert at the found position
        result.splice(lo, 0, hit);
    }
    return result;
};

export const castRaysOnEdge = (rays: IRay[], edge: IEdge): RayHit[] => {
    return castRaysOnEdgeRange(rays, 0, rays.length, edge);
};

/**
 * Cast rays on an edge within a specified range, avoiding array slice allocation.
 * @param rays The full array of rays
 * @param start Start index (inclusive)
 * @param end End index (exclusive)
 * @param edge The edge to test against
 * @returns Array of RayHit results for the specified range
 */
export const castRaysOnEdgeRange = (rays: IRay[], start: number, end: number, edge: IEdge): RayHit[] => {
    const length = end - start;
    const hits: RayHit[] = new Array(length);
    for (let i = 0; i < length; i++) {
        const ray = rays[start + i];
        const hit = intersectRayEdge(edge, ray);
        hits[i] = (!hit?.intersection)
            ? { ray, edge: null, intersection: null, polygon: null, distance: Number.POSITIVE_INFINITY }
            : hit;
    }
    return hits;
};

const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): CastingStats => {
    // Use for...of instead of forEach for better performance
    for (const x of iStats.polygons) {
        stats.polygons.add(x);
    }
    return ({
        polygons: stats.polygons,
        edgeTests: [Math.min(stats.edgeTests[0], iStats.testedEdges), Math.max(stats.edgeTests[1], iStats.testedEdges)],
        polygonTests: [Math.min(stats.polygonTests[0], iStats.testedPolygons), Math.max(stats.polygonTests[1], iStats.testedPolygons)],
        edgeCount: Math.max(stats.edgeCount, iStats.totalEdges),
        polygonCount: Math.max(stats.polygonCount, iStats.totalPolygons),
        edgePercentage: iStats.totalEdges !== 0 ? Math.max(stats.edgePercentage, iStats.testedEdges / iStats.totalEdges) : stats.edgePercentage
    });
}

const detectCollisions = (ray: IRay, geometry: IGeometry, options: RayCastingOptions): RayCollisions => {
    const totalPolygons = geometry.bsp ? geometry.bsp.count : geometry.polygons.length;
    const result: RayCollisions = { ray, stats: { testedEdges: 0, totalEdges: geometry.edgeCount, totalPolygons, testedPolygons: 0, polygons: new Set<string>() }, hits: [] };
    const polygonIntersections = geometry.bsp
        ? intersectRay(geometry.bsp, ray, options)
        : intersectRayPolygons(geometry.polygons, ray, options);

    result.hits = polygonIntersections.hits;
    result.stats.testedEdges = polygonIntersections.edgeCount;
    result.stats.testedPolygons = polygonIntersections.polygonCount;
    result.stats.polygons = polygonIntersections.polygonIds;
    return result;
};

const needsRendering = (hit: RayHit): boolean => !!lookupMaterialFor(hit.intersection, hit.edge);

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
        return new Promise(function (resolve) {
            worker.postMessage(rays);
            worker.onmessage = function (event) {
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
        return Promise.all(promises).then(results => results.reduce((acc, cur) => ({ castedRays: acc.castedRays.concat(cur.castedRays), stats: cur.stats })));
    }
}