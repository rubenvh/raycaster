import { Action, ActiveActions } from "./actionHandler";

export type KeyMap = {[key: number]: Action};

export class KeyBoardListener {   
    private keyMap: KeyMap = {
        37: 'turnleft',
        39: 'turnright',
        65: 'left',
        68: 'right',
        83: 'down',
        87: 'up',  
        107: 'camera_angle_up',
        109: 'camera_angle_down'
    };
    private ctrlKeyMap: KeyMap = {   
        65: 'add_geometry',          // CTRL A
        83: 'save_world',           // CTRL S
        107: 'camera_depth_up',     // CTRL +
        109: 'camera_depth_down',   // CTRL -
    };

    constructor(private state: ActiveActions){}

    start = ()=> {
        window.addEventListener("keydown", this.keydown, false);
        window.addEventListener("keyup", this.keyup, false);
    };

    private keydown = (event: KeyboardEvent) => {  
        var keyMap = event.ctrlKey ? this.ctrlKeyMap : this.keyMap;            
        var key = keyMap[event.keyCode];        
        this.state[key] = true;
    };

    private keyup = (event: KeyboardEvent) => {
        this.state[this.ctrlKeyMap[event.keyCode]] = false;
        this.state[this.keyMap[event.keyCode]] = false;
    };
}
