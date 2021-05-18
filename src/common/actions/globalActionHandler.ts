import { ipcRenderer } from "electron";
import { useAppDispatch } from "../store";
import { bindCallbackToKey, bindFlagToKey, IActionHandler, makeFlag } from "./actions";
import * as actions from '../store/world-config';
import { toggleTestCanvas } from "../store/ui-config";

const dispatch = useAppDispatch();

export class GlobalActionsHandler implements IActionHandler {
    
    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_config_fadeOut', () => dispatch(actions.toggleFadingStrategy()));        
        bindCallbackToKey(g, 'toggle_test_canvas', () => dispatch(toggleTestCanvas()));
        return this;        
    }
    handle() {}       
    isActive = (): boolean => true;
}