import { Geometry } from './geometry';
import { Camera } from "./camera";
import { Vertex, Edge, Polygon } from './vertex';

export type SelectableElement = Vertex | Edge | Polygon;
export type World = {
    camera: Camera,    
    geometry: Geometry,
    selection: SelectableElement[],
}