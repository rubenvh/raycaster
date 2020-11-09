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
    };

    constructor(private state: ActiveActions){}

    start = ()=> {
        window.addEventListener("keydown", this.keydown, false);
        window.addEventListener("keyup", this.keyup, false);
    };

    private keydown = (event) => {                
        var key = this.keyMap[event.keyCode];        
        this.state[key] = true;
    };

    private keyup = (event) => {
        var key = this.keyMap[event.keyCode];
        this.state[key] = false;
    };
}
