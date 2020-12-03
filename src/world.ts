import { CastedRay } from './raycaster';
import { ICamera } from "./camera";
import { IEdge, IVertex, IPolygon, IGeometry } from './geometry/vertex';
import { loadGeometry } from './geometry/geometry';

export type SelectedVertex = {kind: 'vertex', vertex: IVertex, polygon: IPolygon};
export type SelectedEdge = {kind: 'edge', edge: IEdge, polygon: IPolygon};

export type SelectableElement = SelectedVertex | SelectedEdge;
export type World = {
    camera: ICamera,    
    geometry: IGeometry,
    selection: SelectableElement[],
    rays: CastedRay[]
}

export const loadWorld = (world : World): World => ({...world, geometry: loadGeometry(world.geometry)});

export const hasEdge = (edge: IEdge, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'edge' && _.edge === edge);
}
export const hasVertex = (vertex: IVertex, selection: SelectableElement[]): boolean => {
    return selection.some(_=>_.kind === 'vertex' && _.vertex === vertex);
}