import { CastedRay } from './raycaster';
import { ICamera } from "./camera";
import { IGeometry } from './geometry/geometry';
import { ITextureSource } from './textures/model';
import { WorldLoader } from './storage/stateLoader';

export type World = {
    camera: ICamera,    
    geometry: IGeometry,         
    rays: CastedRay[],
    config?: {fadeOn?: number}
}
export type State = {
    world: World,
    textures: ITextureSource[],    
}
export const globalState: State = {
    world: WorldLoader.initWorld(),
    textures: []
}


