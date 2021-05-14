
import { IGeometry } from './../geometry/geometry';
import { SelectableElement, isPolygon, selectEdge, isEdge, selectVertex, SelectedEdge, selectPolygon } from './selectable';

export interface ISelectionTree {
    children: ISelectionTreeNode[];
}
export interface ISelectionTreeNode extends ISelectionTree {
    element: SelectableElement;
}

export const buildSelectionTree = (selection: SelectableElement[], geometry: IGeometry): ISelectionTreeNode => {
    return ({element: undefined, children: selection.map(_ => buildSelectionBranch(_, geometry))});
}

const buildSelectionBranch = (selection: SelectableElement, geometry: IGeometry): ISelectionTreeNode => {
    if (isPolygon(selection)) {
        return buildTopDownBranch(selection);
    } else if (isEdge(selection)) {
        return buildEdgeBranch(selection, geometry);
    } else {
        return buildBottomUpBranch(selection, geometry);
    }
}

const buildTopDownBranch = (selection: SelectableElement): ISelectionTreeNode  => {
    if (isPolygon(selection)) {
        return ({
            element: selection, 
            children: selection.polygon.edges.map(e => buildTopDownBranch(selectEdge(e, selection.polygon)))});
    } else if (isEdge(selection)) {
        return ({element: selection, children: [
            buildTopDownBranch(selectVertex(selection.edge.start, selection.polygon)),
            buildTopDownBranch(selectVertex(selection.edge.end, selection.polygon))]});
    } else {
        return ({element: selection, children: []});
    }
}

const buildEdgeBranch = (selection: SelectedEdge, geometry: IGeometry): ISelectionTreeNode  => {
    return ({element: selection, children: [
        buildTopDownBranch(selectPolygon(selection.polygon)),
        buildBottomUpBranch(selectVertex(selection.edge.start, selection.polygon), geometry),
        buildBottomUpBranch(selectVertex(selection.edge.end, selection.polygon), geometry)]});
}

const buildBottomUpBranch = (selection: SelectableElement, geometry: IGeometry): ISelectionTreeNode  => {
    if (isPolygon(selection)) {
        return ({element: selection, children: []});            
    } else if (isEdge(selection)) {
        return ({element: selection, children: []});
    } else {
        const polygon = geometry.polygons.find(p => p.id === selection.polygon.id);
        const edges = polygon.edges.filter(_=>_.start.id === selection.vertex.id || _.end.id === selection.vertex.id);
        return ({element: selection, children: [
            buildBottomUpBranch(selectPolygon(polygon), geometry),
            ...edges.map(e => buildBottomUpBranch(selectEdge(e, polygon), geometry))
        ]});
    }
}

