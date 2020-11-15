import { Geometry } from './geometry';
import { Camera } from "./camera";
import { IEdge, IVertex, IPolygon } from './vertex';

export type SelectableElement = IVertex | IEdge | IPolygon;
export type World = {
    camera: Camera,    
    geometry: Geometry,
    selection: SelectableElement[],
}