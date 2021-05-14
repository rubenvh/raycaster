import { ipcRenderer } from "electron";
import { useAppDispatch } from "../store";
import { IActionHandler } from "./actions";
import * as actions from '../store/world-config';

const dispatch = useAppDispatch();

export class GlobalActionsHandler implements IActionHandler {
    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_config_fadeOut', () => dispatch(actions.toggleFadingStrategy()));
        return this;        
    }
    handle() {}       
    isActive = (): boolean => true;
}