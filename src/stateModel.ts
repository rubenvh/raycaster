import { CastedRay } from './raycaster';
import { ICamera } from "./camera";
import { IGeometry } from './geometry/geometry';
import { SelectableElement } from './geometry/selectable';

export type World = {
    camera: ICamera,    
    geometry: IGeometry,     
    selection: SelectableElement[],
    rays: CastedRay[]   
}
export type State = {
    level: World,
    textures: ITextureSource[],
    
}


