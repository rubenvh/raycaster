import { CastedRay } from './raycaster';
import { ICamera } from "./camera";
import { IEdge, IVertex, IPolygon, IGeometry } from './vertex';
import { loadGeometry } from './geometry';

export type SelectableElement = IVertex | IEdge | IPolygon;
export type World = {
    camera: ICamera,    
    geometry: IGeometry,
    selection: SelectableElement[],
    rays: CastedRay[]
}

export const loadWorld = (world : World): World => ({...world, geometry: loadGeometry(world.geometry)});