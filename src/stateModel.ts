import { ITextureSource } from './textures/model';
import { WorldLoader } from './storage/stateLoader';

/* 
    world
        walls
            geometry
            bsp
        doors
            geometry
        characters


    player
        camera
    configuration
    textures
    systemInfo
        stats
        rays

    

 */
export type World = {        
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


