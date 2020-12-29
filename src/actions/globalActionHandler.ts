import { ipcRenderer } from "electron";
import { World } from "../stateModel";
import { IActionHandler } from "./actions";
export class GlobalActionsHandler implements IActionHandler {
        
    constructor(private world: World) {}

    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_config_fadeOut', this.adaptFadingStrategy);            
        return this;        
    }

    handle() {}   
    
    isActive = (): boolean => true;

    adaptFadingStrategy = () => {
        if (this.world.config.fadeOn == null) {
            this.world.config.fadeOn = 0;
        } else if (this.world.config.fadeOn <= 245) {
            this.world.config.fadeOn += 10;
        } else {
            this.world.config.fadeOn = null;
        }
    }
}