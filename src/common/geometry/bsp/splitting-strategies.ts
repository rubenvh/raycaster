import { classifyPointToPlane, classifyPolygonToPlane } from './classification';
import { PointToPlaneRelation, PolygonToPlaneRelation } from "./model";
import { createPlane, Plane } from './../../math/plane';
import { IPolygon } from './../polygon';
import { ILineSegment } from '../../math/lineSegment';

export const randomEdgeToPlane = (polygon: IPolygon, depth: number): Plane => {
    const index = Math.floor(Math.random() * polygon.edges.length);
    return createPlane(polygon.edges[index].segment);
};

export const randomBoundingSideToPlane = (polygon: IPolygon, depth: number): Plane => {
    const [[x1, y1], [x2, y2]] = polygon.boundingBox;
    const sides: ILineSegment[] = depth % 2 === 0 ? [
        [[x1,y1],[x1,y2]],
        [[x2,y2],[x2,y1]],
    ] : [
        [[x1,y1],[x2,y1]],
        [[x2,y2],[x1,y2]],        
    ];
    const index = Math.floor(Math.random() * 2);
    return createPlane(sides[index]);
}  

export const searchSplitPlane = (polygons: IPolygon[], depth: number, planeCreator: (polygon: IPolygon, depth: number) => Plane): Plane => {

    // Blend factor for optimizing for balance or splits
    const k: number = 0.8;
    // variables for tracking best splitting plane seen so far
    let bestPlane: Plane | null = null;
    let bestScore = Number.MAX_VALUE;

    for (const polygon of polygons) {
        let counts = new Map<PolygonToPlaneRelation, number>();
        const plane = planeCreator(polygon, depth);

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

};