import { classifyPolygonToPlane } from './classification';
import { PolygonToPlaneRelation } from "./model";
import { createPlane, isSamePlane, Plane, VOID_PLANE } from './../../math/plane';
import { centerOf, IPolygon } from './../polygon';
import { ILineSegment } from '../../math/lineSegment';
import { IEdge } from '../edge';
import { distanceSqr } from '../../math/vector';


export const randomEdgeToPlane = (polygon: IPolygon, depth: number): Plane => {
    const index = Math.floor(Math.random() * polygon.edges.length);
    return createPlane(polygon.edges[index].segment);
};

export const closestToMidpoint = (polygon: IPolygon, depth: number): Plane => {
    // Cache center and use distanceSqr (no sqrt) with a 2-element min-scan instead of full sort
    const center = centerOf(polygon.boundingBox);
    const verts = polygon.vertices;
    let best0 = 0;
    let best1 = 1;
    let dist0 = distanceSqr(center, verts[0].vector);
    let dist1 = distanceSqr(center, verts[1].vector);
    if (dist1 < dist0) {
        // swap so dist0 <= dist1
        best0 = 1; best1 = 0;
        const tmp = dist0; dist0 = dist1; dist1 = tmp;
    }
    for (let i = 2; i < verts.length; i++) {
        const d = distanceSqr(center, verts[i].vector);
        if (d < dist0) {
            best1 = best0; dist1 = dist0;
            best0 = i; dist0 = d;
        } else if (d < dist1) {
            best1 = i; dist1 = d;
        }
    }
    return createPlane([verts[best0].vector, verts[best1].vector]);
};

export const randomVerticesToPlane = (polygon: IPolygon, depth: number): Plane => {
    const index1 = Math.floor(Math.random() * polygon.vertices.length);
    const index2 = Math.floor(Math.random() * polygon.vertices.length);
    return createPlane([polygon.vertices[index1].vector, polygon.vertices[index2].vector]);
};

export const randomAlternatingHorVerEdgeToPlane = (polygon: IPolygon, depth: number): Plane => {
    const hor = depth % 2 === 0;
    let selectedEdge: IEdge = polygon.edges[0];
    for (const e of polygon.edges) {
        if (hor && Math.abs(e.slope) < Math.abs(selectedEdge.slope)) {
            selectedEdge = e;
        } else if (!hor && Math.abs(e.slope) > Math.abs(selectedEdge.slope)) {
            selectedEdge = e;
        }
    }
    return createPlane(selectedEdge.segment);
};
export const randomBoundingSideToPlane = (polygon: IPolygon, depth: number): Plane => {
    const [[x1, y1], [x2, y2]] = polygon.boundingBox;
    const sides: ILineSegment[] = depth % 2 === 0 ? [
        [[x1, y1], [x1, y2]], // TOP + BOTTOM lines (horizontal)
        [[x2, y2], [x2, y1]],
    ] : [
        [[x1, y1], [x2, y1]], // LEFT + RIGHT lines (vertical)
        [[x2, y2], [x1, y2]],
    ];
    const index = Math.floor(Math.random() * 2);
    return createPlane(sides[index]);
}

export const SPLITTING_STRATEGIES = [
    randomAlternatingHorVerEdgeToPlane,
    closestToMidpoint,
    randomBoundingSideToPlane,
    randomVerticesToPlane,
    randomEdgeToPlane
];

export const searchSplitPlane = (polygons: IPolygon[], depth: number, planeCreator: (polygon: IPolygon, depth: number) => Plane, previousSplitPlane: Plane | null): [Plane, number] => {

    // Blend factor for optimizing for balance or splits
    const k: number = 0.7;
    // variables for tracking best splitting plane seen so far
    let bestPlane = VOID_PLANE;
    let bestScore = Number.MAX_VALUE;

    for (const polygon of polygons) {
        const plane = planeCreator(polygon, depth);
        if (isSamePlane(plane, previousSplitPlane)) { continue };

        let numFront = 0;
        let numBehind = 0;
        let numStraddling = 0;

        for (const testPolygon of polygons) {
            if (testPolygon === polygon) continue;
            let relation = classifyPolygonToPlane(testPolygon, plane);
            if (relation === PolygonToPlaneRelation.Coplanar) relation = PolygonToPlaneRelation.InFront;
            switch (relation) {
                case PolygonToPlaneRelation.InFront: numFront++; break;
                case PolygonToPlaneRelation.Behind: numBehind++; break;
                case PolygonToPlaneRelation.Straddling: numStraddling++; break;
            }
        }

        const score = k * numStraddling + (1 - k) * Math.abs(numFront - numBehind);
        if (score < bestScore) {
            bestScore = score;
            bestPlane = plane;
        }
    }

    return [bestPlane, bestScore];

};