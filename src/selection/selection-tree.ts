
import { IGeometry } from './../geometry/geometry';
import { SelectableElement, isPolygon, selectEdge, isEdge, selectVertex, SelectedEdge, selectPolygon } from './selectable';

export interface ISelectionTree {
    children: ISelectionTreeNode[];
}
export interface ISelectionTreeNode extends ISelectionTree {
    element: SelectableElement;
}

export const buildSelectionTree = (selection: SelectableElement[], geometry: IGeometry): ISelectionTree => {
    return ({children: selection.map(_ => buildSelectionBranch(_, geometry))});
}

export const buildSelectionBranch = (selection: SelectableElement, geometry: IGeometry): ISelectionTreeNode => {
    if (isPolygon(selection)) {
        return buildPolygonBranch(selection);
    } else if (isEdge(selection)) {
        return buildEdgeBranch(selection, geometry);
    } else {
        return buildVertexBranch(selection, geometry);
    }
}

export const buildPolygonBranch = (selection: SelectableElement): ISelectionTreeNode  => {
    if (isPolygon(selection)) {
        return ({
            element: selection, 
            children: selection.polygon.edges.map(e => buildPolygonBranch(selectEdge(e, selection.polygon)))});
    } else if (isEdge(selection)) {
        return ({element: selection, children: [
            buildPolygonBranch(selectVertex(selection.edge.start, selection.polygon)),
            buildPolygonBranch(selectVertex(selection.edge.end, selection.polygon))]});
    } else {
        return ({element: selection, children: []});
    }
}

export const buildEdgeBranch = (selection: SelectedEdge, geometry: IGeometry): ISelectionTreeNode  => {
    return ({element: selection, children: [
        buildPolygonBranch(selectPolygon(selection.polygon)),
        buildVertexBranch(selectVertex(selection.edge.start, selection.polygon), geometry),
        buildVertexBranch(selectVertex(selection.edge.end, selection.polygon), geometry)]});
}

export const buildVertexBranch = (selection: SelectableElement, geometry: IGeometry): ISelectionTreeNode  => {
    if (isPolygon(selection)) {
        return ({element: selection, children: []});            
    } else if (isEdge(selection)) {
        return ({element: selection, children: []});
    } else {
        const polygon = geometry.polygons.find(p => p.id === selection.polygon.id);
        const edges = polygon.edges.filter(_=>_.start.id === selection.vertex.id || _.end.id === selection.vertex.id);
        return ({element: selection, children: [
            buildVertexBranch(selectPolygon(polygon), geometry),
            ...edges.map(e => buildVertexBranch(selectEdge(e, polygon), geometry))
        ]});
    }
}

