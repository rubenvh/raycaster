import { searchSplitPlane, randomEdgeToPlane, randomBoundingSideToPlane } from './splitting-strategies';
import { intersectSegmentPlane, Plane } from '../../math/plane';
import { Vector } from '../../math/vector';
import { IPolygon, createPolygon } from './../polygon';
import { classifyPointToPlane } from './classification';
import { PointToPlaneRelation } from "./model";

/**
 * Given a list of polygons, attempts to compute a good splitting plane.
 */
export function pickSplittingPlane(polygons: IPolygon[], depth: number): Plane {

    return searchSplitPlane(polygons, depth, randomEdgeToPlane);
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
