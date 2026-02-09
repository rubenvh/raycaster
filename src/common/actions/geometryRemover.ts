import { createVertexMap } from '../selection/selectable';
import { IActionHandler } from './actions';
import { SelectableElement } from '../selection/selectable';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import { clearSelection } from '../store/selection';
import { remove } from '../store/walls';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class GeometryRemover implements IActionHandler {
        
    private selectedElements: SelectableElement[] = [];
    private unsubscribe: () => void;
    
    constructor() {
        this.unsubscribe = connect(s => {
            this.selectedElements = s.selection.elements;         
        });
    }

    register(_: GlobalEventHandlers): IActionHandler {        
        window.electronAPI.on('geometry_remove', this.deleteSelection);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_remove', this.deleteSelection);
    }

    handle(): void {}

    public isActive = () => this.selectedElements.length > 0;
    
    private deleteSelection = () => {        
        if (this.isActive()) {
            const map = createVertexMap(this.selectedElements);            
            dispatch(clearSelection());
            dispatch(remove(map));            
        }        
    }
}