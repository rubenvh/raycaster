import { World } from "../world";
import { bindFlagToKey, Flag, IActionHandler, isActive, makeFlag } from "./actions";

const GLOBAL_ACTIONS = ["save_world"] as const;
type GlobalAction = typeof GLOBAL_ACTIONS[number];

export class GlobalActionsHandler implements IActionHandler {
    
    
    private flags: {[key in GlobalAction]: Flag};
    
    constructor(private world: World) {}

    register(g: GlobalEventHandlers): IActionHandler {
        // this.flags = GLOBAL_ACTIONS.reduce((acc, x) => {
        //     const flag = makeFlag();
        //     bindFlagToKey(g, x, flag);
        //     return ({...acc, [x]: flag});
        // }, {} as {[key in GlobalAction]: Flag});
        return this;        
    }

    handle() {
        // if (this.isActive()){
        //     localStorage.setItem('geometry', JSON.stringify(this.world.geometry));
        //     localStorage.setItem('camera', JSON.stringify(this.world.camera));
        // } 
    }   
    
    isActive = (): boolean => isActive(this.flags.save_world);
}