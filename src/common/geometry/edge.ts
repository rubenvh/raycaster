import { ILineSegment, slope } from '../math/lineSegment';
import { Vector, ZERO } from "../math/vector";
import { cloneKey, giveIdentity, IEntity } from "./entity";
import { cloneMaterial, Color, IDirectedMaterial } from "./properties";
import { areClose, cloneVertex, distance, duplicateVertex, IVertex, makeVertex, NULL_VERTEX } from "./vertex";

type EdgeBase = IEntity & { start: IVertex, end: IVertex, material?: IDirectedMaterial, immaterial?: boolean };
export type IEdge = EdgeBase & { length: number, slope: number, luminosity: number, segment: ILineSegment };
export type IStoredEdge = EdgeBase;
export const storeEdge = (e: IEdge): IStoredEdge => ({
    id: cloneKey(e.id),
    start: e.start,
    end: e.end,
    immaterial: e.immaterial,
    material: e.material,
})

export const determineLuminosity = (slope: number): number => {
    let percentage = 0.4;
    let m = Math.abs(slope || 0);
    if (!isFinite(m)) return 1;
    return percentage + (m / (1 + m)) * (1 - percentage);
};


export const loadEdge = (e: IStoredEdge): IEdge => {
    const segment: ILineSegment = [e.start.vector, e.end.vector];
    const m: number = slope(segment);
    return ({
        id: cloneKey(e.id),
        start: e.start,
        end: e.end,
        material: e.material,
        immaterial: e.immaterial,
        length: distance(e.start, e.end),
        slope: m,
        segment,
        luminosity: determineLuminosity(m)
    });
};

export const makeEdge = (v: Vector, u: Vector): IEdge => loadEdge({
    start: makeVertex(v),
    end: makeVertex(u),
});

export const NULL_EDGE: IEdge = makeEdge(ZERO, ZERO);

export const duplicateEdge = (e: IEdge, delta: Vector): IEdge => giveIdentity<IEdge>({
    start: duplicateVertex(e.start, delta),
    end: duplicateVertex(e.end, delta),
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),
    length: e.length,
    slope: e.slope,
    segment: e.segment,
    luminosity: e.luminosity,
});

export const cloneEdge = (e: IEdge, start: Vector = null, end: Vector = null): IEdge => loadEdge({
    id: cloneKey(e.id),
    start: start ? makeVertex(start) : cloneVertex(e.start),
    end: end ? makeVertex(end) : cloneVertex(e.end),
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),
});

/**
 * Lightweight edge clipping: creates a clipped IEdge that references the original's
 * material and id (no deep clone), and copies luminosity/slope from the original
 * (clipping doesn't change the line's direction). Only creates new vertex objects
 * when clipping actually changes the endpoint.
 * 
 * This avoids: cloneMaterial (deep clone of color arrays + texture), cloneKey,
 * and loadEdge overhead (recomputing slope, determineLuminosity, distance).
 */
export const clipEdgeLightweight = (e: IEdge, start: Vector = null, end: Vector = null): IEdge => {
    const sv = start ? makeVertex(start) : e.start;
    const ev = end ? makeVertex(end) : e.end;
    const segment: ILineSegment = [sv.vector, ev.vector];
    // Length recomputation: only needed if a vertex changed, but since WallProps.length is
    // currently unused downstream (texture uses tileFactor constant), we use a cheap approximation
    // via dx/dy when clipped, or copy original length when not clipped.
    let len: number;
    if (start || end) {
        const dx = sv.vector[0] - ev.vector[0];
        const dy = sv.vector[1] - ev.vector[1];
        len = Math.sqrt(dx * dx + dy * dy);
    } else {
        len = e.length;
    }
    return {
        id: e.id,                // reference original id (no cloneKey)
        start: sv,
        end: ev,
        material: e.material,    // reference original material (no cloneMaterial)
        immaterial: e.immaterial,
        length: len,
        slope: e.slope,          // same line direction after clipping
        segment,
        luminosity: e.luminosity // same slope => same luminosity
    };
};


export const clipEdge = (e: IEdge,): IEdge => loadEdge({
    id: cloneKey(e.id),
    start: cloneVertex(e.start),
    end: cloneVertex(e.end),
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),
});

export const createEdges = (vectors: Vector[]): IEdge[] => {
    // transform all vectors into vertices
    const vertices = vectors.map(makeVertex).map(giveIdentity);
    const startingVertex = vertices[0];

    // we are closing the polygon at the end, so remove the last vertex if it's close to the starting vertex
    if (areClose(startingVertex, vertices[vertices.length - 1])) vertices.pop();

    // put start at the end and reduce over the vertices to create a collection of edges
    return vertices.slice(1).concat([startingVertex])
        .reduce((acc, v) => {
            return ({
                edges: [...acc.edges, loadEdge({
                    start: acc.previous,
                    end: v,
                    material: { color: [255, 20, 20, 0.2] as Color },
                    immaterial: false
                })],
                previous: v,
            });
        },
            { previous: startingVertex, edges: [] as IEdge[] })
        .edges;
}

