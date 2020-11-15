import { Camera } from "./camera";
import { IEdge, IVertex, IPolygon, IGeometry } from './vertex';

export type SelectableElement = IVertex | IEdge | IPolygon;
export type World = {
    camera: Camera,    
    geometry: IGeometry,
    selection: SelectableElement[],
}