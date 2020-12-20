import { CastedRay } from './raycaster';
import { ICamera } from "./camera";
import { IGeometry } from './geometry/geometry';
import { SelectableElement } from './geometry/selectable';
import { ITextureSource } from './textures/model';

export type World = {
    camera: ICamera,    
    geometry: IGeometry,     
    selection: SelectableElement[],
    rays: CastedRay[]   
}
export type State = {
    world: World,
    textures: ITextureSource[],
    
}


