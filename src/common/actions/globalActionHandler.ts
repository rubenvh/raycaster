import { ipcRenderer } from "electron";
import { useAppDispatch } from "../store";
import { bindCallbackToKey, IActionHandler } from "./actions";
import * as actions from '../store/world-config';
import { toggleBspDrawing, toggleTestCanvas } from "../store/ui-config";

const dispatch = useAppDispatch();

export class GlobalActionsHandler implements IActionHandler {
    
    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_config_fadeOut', () => dispatch(actions.toggleFadingStrategy()));        
        bindCallbackToKey(g, 'toggle_test_canvas', () => dispatch(toggleTestCanvas()));
        bindCallbackToKey(g, 'toggle_draw_bsp', () => dispatch(toggleBspDrawing()));
        return this;        
    }
    handle() {}       
    isActive = (): boolean => true;
}