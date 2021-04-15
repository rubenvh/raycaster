import { IGeometry } from './geometry/geometry';
import { ITextureSource } from './textures/model';
import { WorldLoader } from './storage/stateLoader';

/* 
    geometry
        elements
        bsp
        nonstatic
            doors
            npcs

    player
        camera
    configuration
    textures
    systemInfo
        stats
        rays

    

 */
export type World = {    
    geometry: IGeometry,   
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


