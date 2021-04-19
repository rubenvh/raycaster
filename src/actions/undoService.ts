import { ipcRenderer } from 'electron';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';

const dispatch = useAppDispatch();

export class UndoService {                
    constructor() {        
        ipcRenderer.on('undo', () => dispatch(actions.undo()));
        ipcRenderer.on('redo', () => dispatch(actions.redo()));        
    }       
}
