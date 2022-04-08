import { areClose, areEqual, IVertex } from './../vertex';
import { cloneEdge, IEdge, loadEdge } from './../edge';
import { searchSplitPlane, SPLITTING_STRATEGIES } from './splitting-strategies';
import { intersectSegmentPlane, isSamePlane, Plane, VOID_PLANE } from '../../math/plane';
import { createPolygon, IPolygon, isConvex, loadPolygon } from './../polygon';
import { classifyPointToPlane } from './classification';
import { PointToPlaneRelation } from "./model";
import { makeVertex } from '../vertex';
import { round, Vector } from '../../math/vector';

/**
 * Given a list of polygons, attempts to compute a good splitting plane.
 */
export const pickSplittingPlane = (polygons: IPolygon[], depth: number, previousSplitPlane: Plane): Plane => {

    let plane: Plane = VOID_PLANE;
    let bestScore = Number.MAX_VALUE;
    for (let s of SPLITTING_STRATEGIES) {
        let [p, score] = polygons.length === 1
            ? searchSplitPlaneInSinglePolygon(polygons[0], depth, s, previousSplitPlane)
            : searchSplitPlane(polygons, depth, s, previousSplitPlane);
        if (!isSamePlane(p, VOID_PLANE)
            && !isSamePlane(p, previousSplitPlane)
            && score <= bestScore) {
            plane = p;
            bestScore = score;
        }
    }
    return plane;
}

const searchSplitPlaneInSinglePolygon = (polygon: IPolygon, depth: number, planeCreator: (polygon: IPolygon, depth: number) => Plane, previousSplitPlane: Plane | null): [Plane, number] => {
    const plane = planeCreator(polygon, depth);
    if (isSamePlane(plane, previousSplitPlane)) { return [VOID_PLANE, Number.MAX_VALUE]; }
    const [p1, p2] = splitPolygon(polygon, plane);
    const c1 = isConvex(p1);
    const c2 = isConvex(p2);
    const balance = Math.abs(p1.vertices.length - p2.vertices.length)/(p1.vertices.length+p2.vertices.length);
    return [plane, (c1 ? 0 : 1) + (c2 ? 0 : 1) + balance];
};
/**
 * Splits a polygon on the given splitting plane. This function results in 2 subpolygons: 
 * one in front and one in the back of the given splitting plane.
 */
export const splitPolygon = (polygon: IPolygon, plane: Plane): [IPolygon, IPolygon] => {
    const frontEdges: IEdge[] = [];
    const backEdges: IEdge[] = [];
    for (let edge of polygon.edges) {
        const aSide = classifyPointToPlane(edge.start.vector, plane);
        const bSide = classifyPointToPlane(edge.end.vector, plane);

        if (bSide == PointToPlaneRelation.InFront) {
            if (aSide == PointToPlaneRelation.Behind) {
                const { q } = intersectSegmentPlane(edge.segment, plane);
                if (q == null) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                const shouldBeOnPlane = classifyPointToPlane(q, plane);
                if (shouldBeOnPlane !== PointToPlaneRelation.On) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                addEdge(frontEdges, cloneEdge({ ...edge, start: makeVertex(q!), end: edge.end }));
                addEdge(backEdges, cloneEdge({ ...edge, start: edge.start, end: makeVertex(q!) }));
            } else {
                addEdge(frontEdges, cloneEdge(edge));
            }

        } else if (bSide == PointToPlaneRelation.Behind) {
            if (aSide == PointToPlaneRelation.InFront) {
                const { q } = intersectSegmentPlane(edge.segment, plane);
                if (q == null) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                const shouldBeOnPlane = classifyPointToPlane(q, plane);
                if (shouldBeOnPlane !== PointToPlaneRelation.On) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                addEdge(frontEdges, cloneEdge({ ...edge, start: edge.start, end: makeVertex(q!) }));
                addEdge(backEdges, cloneEdge({ ...edge, start: makeVertex(q!), end: edge.end }));
            } else {
                addEdge(backEdges, cloneEdge(edge));
            }

        } else {
            addEdge(
                aSide == PointToPlaneRelation.Behind ? backEdges : frontEdges,
                cloneEdge(edge));
        }
    }
    return [
        loadPolygon({ id: polygon.id, edges: closeIfNeeded(frontEdges) }),
        loadPolygon({ id: polygon.id, edges: closeIfNeeded(backEdges) })];
};

/**
 * add a new edge to a list while preventing gaps: if start does not match end of previously added edge, 
 * this function adds an invisible ghost edge in between
 */
const addEdge = (edges: IEdge[], edge: IEdge) => {
    addSplitEdge(edges, edge);
    edges.push(edge);
};
const createSplitEdge = (start: IVertex, end: IVertex): IEdge => loadEdge({ immaterial: true, start, end, material: undefined /*{color: [0,255,0,0.5]}*/ })
const addSplitEdge = (edges: IEdge[], edge: IEdge): void => {
    if (edges.length > 0) {
        const previousEnd = edges[edges.length - 1].end;
        if (!areClose(previousEnd, edge.start)) {
            edges.push(createSplitEdge(previousEnd, edge.start));
        }
    }
}

const closeIfNeeded = (edges: IEdge[]): IEdge[] => {
    if (edges.length < 1) { return edges; }
    const result: IEdge[] = [];
    for (let e of edges) {
        if (result.length > 0) {
            const previous = result[result.length - 1];
            if (!areEqual(e.start, previous.end)) {
                result.push(createSplitEdge(previous.end, e.start))
            }
        }
        result.push(e);
    }
    const start = result[0].start;
    const end = result[result.length - 1].end;
    if (!areEqual(start, end)) {
        result.push(createSplitEdge(end, start))
    }
    return result;
}

export function oldSplitPolygon(polygon: IPolygon, plane: Plane): [IPolygon, IPolygon] {
    const numVerts = polygon.vertices.length;
    const frontVerts: Vector[] = [];
    const backVerts: Vector[] = [];
    let a = polygon.vertices[numVerts - 1];
    let aSide = classifyPointToPlane(a.vector, plane);

    for (const b of polygon.vertices) {
        const bSide = classifyPointToPlane(b.vector, plane);
        if (bSide == PointToPlaneRelation.InFront) {
            if (aSide == PointToPlaneRelation.Behind) {
                const { t, q } = intersectSegmentPlane([a.vector, b.vector], plane);
                if (q == null) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                const shouldBeOnPlane = classifyPointToPlane(q, plane);
                if (shouldBeOnPlane !== PointToPlaneRelation.On) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                frontVerts.push(q!);
                backVerts.push(q!);
            }
            frontVerts.push(b.vector);

        } else if (bSide == PointToPlaneRelation.Behind) {
            if (aSide == PointToPlaneRelation.InFront) {
                const { t, q } = intersectSegmentPlane([a.vector, b.vector], plane);
                if (q == null) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                const shouldBeOnPlane = classifyPointToPlane(q, plane);
                if (shouldBeOnPlane !== PointToPlaneRelation.On) { throw new Error('Floating point error: expected intersection. Increase error margin.'); }
                frontVerts.push(q!);
                backVerts.push(q!);
            } else if (aSide == PointToPlaneRelation.On) {
                backVerts.push(a.vector);
            }
            backVerts.push(b.vector);

        } else {
            frontVerts.push(b.vector);
            if (aSide == PointToPlaneRelation.Behind) {
                backVerts.push(b.vector);
            }
        }

        a = b;
        aSide = bSide;
    }

    return [createPolygon(frontVerts), createPolygon(backVerts)];
}