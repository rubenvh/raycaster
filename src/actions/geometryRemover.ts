import { createVertexMap } from './../geometry/selectable';
import { IActionHandler } from './actions';
import { SelectableElement } from '../geometry/selectable';
import { ipcRenderer } from 'electron';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import { clearSelection } from '../store/selection';
import { remove } from '../store/walls';

const dispatch = useAppDispatch();

export class GeometryRemover implements IActionHandler {
        
    private selectedElements: SelectableElement[] = [];
    
    constructor() {
        connect(s => {
            this.selectedElements = s.selection.elements;         
        });
    }

    register(g: GlobalEventHandlers): IActionHandler {        
        ipcRenderer.on('geometry_remove', this.deleteSelection);
        return this;
    }

    handle(): void {}

    public isActive = () => this.selectedElements.length > 0;
    
    private deleteSelection = () => {        
        if (this.isActive()) {
            const map = createVertexMap(this.selectedElements);            
            dispatch(remove(map));
            dispatch(clearSelection());
        }        
    }
}