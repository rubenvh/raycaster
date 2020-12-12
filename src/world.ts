import { CastedRay } from './raycaster';
import { ICamera } from "./camera";
import { IGeometry, loadGeometry } from './geometry/geometry';
import { SelectableElement } from './geometry/selectable';


export type World = {
    camera: ICamera,    
    geometry: IGeometry,
    selection: SelectableElement[],
    rays: CastedRay[]
}

export const loadWorld = (world : World): World => ({...world, geometry: loadGeometry(world.geometry)});

