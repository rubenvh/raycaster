import { distanceTo } from "../math/lineSegment";
import { Vector } from "../math/vector";
import { EdgeCollision, VertexCollision } from "../geometry/collision";
import { IEdge } from "../geometry/edge";
import { IEntityKey } from "../geometry/entity";
import { IPolygon } from "../geometry/polygon";
import { distance, IVertex } from "../geometry/vertex";

export type SelectedVertex = {kind: 'vertex', vertex: IVertex, polygon: IPolygon};
export type SelectedEdge = {kind: 'edge', edge: IEdge, polygon: IPolygon};
export type SelectedPolygon = {kind: 'polygon', polygon: IPolygon};
export const isVertex = (_: SelectableElement): _ is SelectedVertex => _.kind === 'vertex';
export const isEdge = (_: SelectableElement): _ is SelectedEdge => _.kind === 'edge';
export const isPolygon = (_: SelectableElement): _ is SelectedPolygon => _.kind === 'polygon';
export const selectedId = (_ : SelectableElement) => isVertex(_) ? _.vertex.id : isEdge(_) ? _.edge.id : _.polygon.id;
export const selectVertex = (vertex: IVertex, polygon: IPolygon): SelectedVertex => ({kind: 'vertex', vertex, polygon});
export const selectEdge = (edge: IEdge, polygon: IPolygon): SelectedEdge => ({kind: 'edge', edge, polygon});
export const selectPolygon = (polygon: IPolygon): SelectedPolygon => ({kind: 'polygon', polygon});
export type SelectableElement = SelectedVertex | SelectedEdge | SelectedPolygon;

export const isSelectedPolygon = (id: IEntityKey, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'polygon' && _.polygon.id === id);
}
export const isSelectedEdge = (id: IEntityKey, selection: SelectableElement[]): boolean => {
    return selection.some(_=> _.kind === 'edge' && _.edge.id === id);
}
export const isSelectedVertex = (id: IEntityKey, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'vertex' && _.vertex.id === id);
}

export const isCloseToSelected = (v: Vector, element: SelectableElement) => {
    const epsilon = 5;
    return isVertex(element)
        ? distance(v, element.vertex) < epsilon
        : isEdge(element)
        ? distanceTo(v, element.edge.segment) < epsilon
        : element.polygon.edges.map(e => distanceTo(v, e.segment) < epsilon).some(x => x);
}

export const selectedElement = (collision : VertexCollision|EdgeCollision, selectPolygon: boolean): SelectableElement => {
    if (!collision) return null;
    if (selectPolygon) { return ({kind: 'polygon', polygon: collision.polygon})};
    return collision.kind === 'edge' 
    ? ({kind: collision.kind, edge: collision.edge, polygon: collision.polygon }) 
    : ({kind: collision.kind, vertex: collision.vertex, polygon: collision.polygon });
}

export const createVertexMap = (elements: SelectableElement[]) => elements.reduce((acc, s) => {
    return acc.set(s.polygon.id, Array.from(new Set<IVertex>([...(acc.get(s.polygon.id)||[]).concat(
        isVertex(s)
        ? [s.vertex]
        : isEdge(s)
        ? [s.edge.start, s.edge.end]
        : s.polygon.vertices)])));
}, new Map());