import { ICamera } from "./camera";
import { IEdge, IVertex, IPolygon, IGeometry } from './vertex';

export type SelectableElement = IVertex | IEdge | IPolygon;
export type World = {
    camera: ICamera,    
    geometry: IGeometry,
    selection: SelectableElement[],
}