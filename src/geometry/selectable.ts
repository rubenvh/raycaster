import { distanceTo } from "../math/lineSegment";
import { Vector } from "../math/vector";
import { EdgeCollision, VertexCollision } from "./collision";
import { IEdge, segmentFrom } from "./edge";
import { IPolygon } from "./polygon";
import { distance, IVertex } from "./vertex";

export type SelectedVertex = {kind: 'vertex', vertex: IVertex, polygon: IPolygon};
export type SelectedEdge = {kind: 'edge', edge: IEdge, polygon: IPolygon};
export type SelectedPolygon = {kind: 'polygon', polygon: IPolygon};
export const isVertex = (_: SelectableElement): _ is SelectedVertex => _.kind === 'vertex';
export const isEdge = (_: SelectableElement): _ is SelectedEdge => _.kind === 'edge';
export const isPolygon = (_: SelectableElement): _ is SelectedPolygon => _.kind === 'polygon';

export type SelectableElement = SelectedVertex | SelectedEdge | SelectedPolygon;

export const isSelectedPolygon = (p: IPolygon, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'polygon' && _.polygon.id === p.id);
}
export const isSelectedEdge = (edge: IEdge, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'edge' && _.edge.id === edge.id);
}
export const isSelectedVertex = (vertex: IVertex, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'vertex' && _.vertex.id === vertex.id);
}

export const isCloseToSelected = (v: Vector, element: SelectableElement) => {
    const epsilon = 5;
    return isVertex(element)
        ? distance(v, element.vertex) < epsilon
        : isEdge(element)
        ? distanceTo(v, segmentFrom(element.edge)) < epsilon
        : element.polygon.edges.map(e => distanceTo(v, segmentFrom(e)) < epsilon).some(x => x);
}

export const selectedElement = (collision : VertexCollision|EdgeCollision, selectPolygon: boolean): SelectableElement => {
    if (!collision) return null;
    if (selectPolygon) { return ({kind: 'polygon', polygon: collision.polygon})};
    return collision.kind === 'edge' 
    ? ({kind: collision.kind, edge: collision.edge, polygon: collision.polygon }) 
    : ({kind: collision.kind, vertex: collision.vertex, polygon: collision.polygon });
}