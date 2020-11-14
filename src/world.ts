import { Geometry } from './geometry';
import { Camera } from "./camera";
import { IEdge, IVertex, Polygon } from './vertex';

export type SelectableElement = IVertex | IEdge | Polygon;
export type World = {
    camera: Camera,    
    geometry: Geometry,
    selection: SelectableElement[],
}