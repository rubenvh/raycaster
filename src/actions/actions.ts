export const ALL_ACTIONS = ["turnleft","turnright","right","left","up","down",
                            "camera_angle_up","camera_angle_down","camera_depth_up","camera_depth_down",
                            'geo_add','geo_remove','geo_change_immateriality','geo_change_translucency_down', 'geo_change_translucency_up', 'geo_texture_toggle', 'geo_texture_down','geo_texture_up',
                            'save_world'] as const;
export type Action = typeof ALL_ACTIONS[number]  ;
export type Flag = {value: boolean, blockKeyDown?: boolean};
export const makeFlag = (): Flag => ({value: false});
export const isActive = (f: Flag) => f.value && !f.blockKeyDown;
export const activate = (f: Flag) => f.value = true;
export const deactivate = (f: Flag) => f.blockKeyDown = true;
export const reset = (f: Flag) => f.value = f.blockKeyDown = false;

type KeyDefinition = {key: number, ctrl?: boolean}
type KeyMap = {[key in Action]: KeyDefinition};
const Keys: KeyMap = {
    'turnleft': {key: 37 },                             // left
    'turnright': {key: 39 },                            // right
    'left': {key: 65 },                                 // A
    'right': {key: 68 },                                // D
    'down': {key: 83 },                                 // S
    'up': {key: 87 },                                   // W
    'camera_angle_up': {key: 107 },                     // +
    'camera_angle_down': {key: 109 },                   // -
    'geo_add': {key: 65, ctrl: true },                  // A
    'geo_remove': {key: 88, ctrl: true },               // X
    'geo_change_immateriality': {key: 73, ctrl: true},  // I
    'geo_change_translucency_down': {key: 219, ctrl: true},// [
    'geo_change_translucency_up': {key: 221, ctrl: true},// ]
    'geo_texture_toggle': {key: 84, ctrl: true},          // T 
    'geo_texture_down': {key: 33, ctrl: true},          // PgUp
    'geo_texture_up': {key: 34, ctrl: true},          // PgDown    
    'save_world': {key: 83, ctrl: true },               // S
    'camera_depth_up': {key: 107, ctrl: true },         // +
    'camera_depth_down': {key: 109, ctrl: true },       // -
}

export interface IActionHandler {
    register(g: GlobalEventHandlers): IActionHandler;    
    handle(): void;
    isActive(): boolean;
}

export function bindFlagToKey(g: GlobalEventHandlers, a: Action, flag: Flag) {
    const keyDefiniton = Keys[a];
    g.addEventListener("keydown", (event: KeyboardEvent) => {           
        if (event.keyCode === keyDefiniton.key && !keyDefiniton.ctrl === !event.ctrlKey) {            
            activate(flag);
        }
    }, false);
    g.addEventListener("keyup", (event: KeyboardEvent) => {  
        if (event.keyCode === keyDefiniton.key) {             
          reset(flag);  
        }        
    }, false);
}

export function bindCallbackToKey(g: GlobalEventHandlers, a: Action, c: ()=>void) {
    const keyDefiniton = Keys[a];    
    g.addEventListener("keydown", (event: KeyboardEvent) => {           
        if (event.keyCode === keyDefiniton.key && !keyDefiniton.ctrl === !event.ctrlKey) {            
            c();
        }
    }, false);
}