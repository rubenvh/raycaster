import { useAppDispatch } from "../store";
import { bindCallbackToKey, IActionHandler } from "./actions";
import * as actions from '../store/world-config';
import { cycleBspDrawMode, toggleTestCanvas } from "../store/ui-config";

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class GlobalActionsHandler implements IActionHandler {
    private fadeOutHandler = () => dispatch(actions.toggleFadingStrategy());
    private cleanupFunctions: (() => void)[] = [];
    
    register(g: GlobalEventHandlers): IActionHandler {
        window.electronAPI.on('geometry_config_fadeOut', this.fadeOutHandler);        
        this.cleanupFunctions.push(
            bindCallbackToKey(g, 'toggle_test_canvas', () => dispatch(toggleTestCanvas())),
            bindCallbackToKey(g, 'toggle_draw_bsp', () => dispatch(cycleBspDrawMode()))
        );
        return this;        
    }

    dispose(): void {
        window.electronAPI.off('geometry_config_fadeOut', this.fadeOutHandler);
        this.cleanupFunctions.forEach(fn => fn());
        this.cleanupFunctions = [];
    }

    handle(_deltaTime: number) {}       
    isActive = (): boolean => true;
}