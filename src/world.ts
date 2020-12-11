import { CastedRay } from './raycaster';
import { ICamera } from "./camera";
import { IEdge, IVertex, IPolygon, IGeometry } from './geometry/vertex';
import { loadGeometry } from './geometry/geometry';

export type SelectedVertex = {kind: 'vertex', vertex: IVertex, polygon: IPolygon};
export type SelectedEdge = {kind: 'edge', edge: IEdge, polygon: IPolygon};
export type SelectedPolygon = {kind: 'polygon', polygon: IPolygon};
export const isVertex = (_: SelectableElement): _ is SelectedVertex => _.kind === 'vertex';
export const isEdge = (_: SelectableElement): _ is SelectedEdge => _.kind === 'edge';
export const isPolygon = (_: SelectableElement): _ is SelectedPolygon => _.kind === 'polygon';

export type SelectableElement = SelectedVertex | SelectedEdge | SelectedPolygon;
export type World = {
    camera: ICamera,    
    geometry: IGeometry,
    selection: SelectableElement[],
    rays: CastedRay[]
}

export const loadWorld = (world : World): World => ({...world, geometry: loadGeometry(world.geometry)});

export const isSelectedPolygon = (p: IPolygon, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'polygon' && _.polygon.id === p.id);
}
export const isSelectedEdge = (edge: IEdge, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'edge' && _.edge.id === edge.id);
}
export const isSelectedVertex = (vertex: IVertex, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'vertex' && _.vertex.id === vertex.id);
}