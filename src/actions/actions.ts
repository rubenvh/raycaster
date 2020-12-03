export const ALL_ACTIONS = ["turnleft","turnright","right","left","up","down",
                            "camera_angle_up","camera_angle_down","camera_depth_up","camera_depth_down",
                            'add_geometry',
                            "save_world"] as const;
export type Action = typeof ALL_ACTIONS[number]  ;
export type Flag = {value: boolean};
export const makeFlag = (): Flag => ({value: false});

type KeyDefinition = {key: number, ctrl?: boolean}
type KeyMap = {[key in Action]: KeyDefinition};
const Keys: KeyMap = {
    'turnleft': {key: 37 },
    'turnright': {key: 39 },
    'left': {key: 65 },
    'right': {key: 68 },
    'down': {key: 83 },
    'up': {key: 87 },
    'camera_angle_up': {key: 107 },
    'camera_angle_down': {key: 109 },
    'add_geometry': {key: 65, ctrl: true },
    'save_world': {key: 83, ctrl: true },
    'camera_depth_up': {key: 107, ctrl: true },
    'camera_depth_down': {key: 109, ctrl: true },
}

export interface IActionHandler {
    register(g: GlobalEventHandlers): IActionHandler;    
    handle(): void;
}

export function bindFlagToKey(g: GlobalEventHandlers, a: Action, flag: Flag) {
    const keyDefiniton = Keys[a];
    g.addEventListener("keydown", (event: KeyboardEvent) => {           
        if (event.keyCode === keyDefiniton.key && !keyDefiniton.ctrl === !event.ctrlKey) {
            flag.value = true;        
        }
    }, false);
    g.addEventListener("keyup", (event: KeyboardEvent) => {  
        if (event.keyCode === keyDefiniton.key) flag.value = false;        
    }, false);
}