import { useAppDispatch } from '../store';
import * as actions from '../store/walls';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class UndoService {                
    constructor() {        
        window.electronAPI.on('undo', () => dispatch(actions.undo()));
        window.electronAPI.on('redo', () => dispatch(actions.redo()));        
    }       
}
