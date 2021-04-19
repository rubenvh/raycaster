import { ITextureSource } from './textures/model';

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
export type State = {    
    textures: ITextureSource[],    
}
export const globalState: State = {    
    textures: []
}


