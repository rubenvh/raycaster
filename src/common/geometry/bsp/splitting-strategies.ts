import { classifyPolygonToPlane } from './classification';
import { PolygonToPlaneRelation } from "./model";
import { createPlane, isSamePlane, Plane, VOID_PLANE } from './../../math/plane';
import { centerOf, IPolygon } from './../polygon';
import { ILineSegment, midpoint } from '../../math/lineSegment';
import { IEdge } from '../edge';
import { distance } from '../../math/vector';


export const randomEdgeToPlane = (polygon: IPolygon, depth: number): Plane => {
    const index = Math.floor(Math.random() * polygon.edges.length);
    return createPlane(polygon.edges[index].segment);
};

export const closestToMidpoint = (polygon: IPolygon, depth: number): Plane => {
    const vs = [...polygon.vertices];
    vs.sort((a, b) => {
        return distance(centerOf(polygon.boundingBox), a.vector) < distance(centerOf(polygon.boundingBox), b.vector) ? -1 : 1;
    });    
    return createPlane([vs[0].vector,vs[1].vector ]);
};

export const randomVerticesToPlane = (polygon: IPolygon, depth: number): Plane => {
    const index1 = Math.floor(Math.random() * polygon.vertices.length);
    const index2 = Math.floor(Math.random() * polygon.vertices.length);
    return createPlane([polygon.vertices[index1].vector, polygon.vertices[index2].vector]);
};

export const randomAlternatingHorVerEdgeToPlane = (polygon: IPolygon, depth: number): Plane => {    
    const hor = depth %2 === 0;
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
        [[x1,y1],[x1,y2]], // TOP + BOTTOM lines (horizontal)
        [[x2,y2],[x2,y1]],
    ] : [
        [[x1,y1],[x2,y1]], // LEFT + RIGHT lines (vertical)
        [[x2,y2],[x1,y2]],        
    ];
    const index = Math.floor(Math.random() * 2);
    return createPlane(sides[index]);
}  

export const SPLITTING_STRATEGIES = [
    randomAlternatingHorVerEdgeToPlane,
    closestToMidpoint,
    randomBoundingSideToPlane,
    randomVerticesToPlane, 
    randomEdgeToPlane];

export const searchSplitPlane = (polygons: IPolygon[], depth: number, planeCreator: (polygon: IPolygon, depth: number) => Plane, previousSplitPlane: Plane|null): [Plane, number] => {

    // Blend factor for optimizing for balance or splits
    const k: number = 0.9;
    // variables for tracking best splitting plane seen so far
    let bestPlane = VOID_PLANE;
    let bestScore = Number.MAX_VALUE;

    for (const polygon of polygons) {
        let counts = new Map<PolygonToPlaneRelation, number>();
        const plane = planeCreator(polygon, depth);
        if (isSamePlane(plane, previousSplitPlane)) { continue };
        
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

    return [bestPlane, bestScore];

};