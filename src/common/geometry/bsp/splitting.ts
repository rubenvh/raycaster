import { createPlane, intersectSegmentPlane, Plane } from '../../math/plane';
import { Vector } from '../../math/vector';
import { IPolygon, createPolygon } from './../polygon';
import { classifyPointToPlane, classifyPolygonToPlane } from './classification';
import { PointToPlaneRelation, PolygonToPlaneRelation } from "./model";

/**
 * Given a list of polygons, attempts to compute a good splitting plane.
 */
export function pickSplittingPlane(polygons: IPolygon[]): Plane {
    // Blend factor for optimizing for balance or splits
    const k: number = 0.8;
    // variables for tracking best splitting plane seen so far
    let bestPlane: Plane | null = null;
    let bestScore = Number.MAX_VALUE;

    for (const polygon of polygons) {
        let counts = new Map<PolygonToPlaneRelation, number>();
        const plane = getPlaneFromPolygon(polygon);

        for (const testPolygon of polygons.filter(_ => _ !== polygon)) {
            let relation = classifyPolygonToPlane(testPolygon, plane);
            if (relation === PolygonToPlaneRelation.Coplanar) relation = PolygonToPlaneRelation.InFront;
            counts.set(relation, (counts.get(relation) || 0) + 1);
        }

        const score = k * (counts.get(PolygonToPlaneRelation.Straddling) || 0) + 
            (1 - k) * Math.abs((counts.get(PolygonToPlaneRelation.InFront) || 0) - (counts.get(PolygonToPlaneRelation.Behind) || 0));
        if (score < bestScore) {
            bestScore = score;
            bestPlane = plane;
        }
    }

    return bestPlane || {d: 0, n: [0,0]};
}

function getPlaneFromPolygon(polygon: IPolygon): Plane {
    // TODO: smarter plane selection ?
    const index = Math.floor(Math.random() * polygon.edges.length);
    return createPlane(polygon.edges[index].segment);
}

export function splitPolygon(polygon: IPolygon, plane: Plane): [IPolygon, IPolygon] {    
    const numVerts = polygon.vertices.length;
    const frontVerts: Vector[] = [];
    const backVerts: Vector[] = [];
    let a = polygon.vertices[numVerts - 1];
    let aSide = classifyPointToPlane(a.vector, plane);

    for (const b of polygon.vertices) {
        const bSide = classifyPointToPlane(b.vector, plane);
        if (bSide == PointToPlaneRelation.InFront) {
            if (aSide == PointToPlaneRelation.Behind) {
                const {t, q} = intersectSegmentPlane([a.vector, b.vector], plane);                  
                if (q == null) { throw new Error('fuck'); }
                const shouldBeOnPlane = classifyPointToPlane(q, plane);
                if (shouldBeOnPlane !== PointToPlaneRelation.On) {throw new Error('fuck2'); }
                frontVerts.push(q!);
                backVerts.push(q!);
            }
            frontVerts.push(b.vector);

        } else if (bSide == PointToPlaneRelation.Behind) {
            if (aSide == PointToPlaneRelation.InFront) {
                const {t, q} = intersectSegmentPlane([a.vector, b.vector], plane);                  
                if (q == null) { throw new Error('fuck'); }
                const shouldBeOnPlane = classifyPointToPlane(q, plane);
                if (shouldBeOnPlane !== PointToPlaneRelation.On) {throw new Error('fuck2'); }
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
