import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { clearSelection } from '../store/selection';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class UndoService {
    private undoHandler = () => { dispatch(clearSelection()); dispatch(actions.undo()); };
    private redoHandler = () => { dispatch(clearSelection()); dispatch(actions.redo()); };
                    
    constructor() {        
        window.electronAPI.on('undo', this.undoHandler);
        window.electronAPI.on('redo', this.redoHandler);        
    }

    dispose(): void {
        window.electronAPI.off('undo', this.undoHandler);
        window.electronAPI.off('redo', this.redoHandler);
    }
}
