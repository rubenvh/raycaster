import { Geometry } from './geometry';
import { Camera } from "./camera";
import { Edge, IVertex, Polygon } from './vertex';

export type SelectableElement = IVertex | Edge | Polygon;
export type World = {
    camera: Camera,    
    geometry: Geometry,
    selection: SelectableElement[],
}