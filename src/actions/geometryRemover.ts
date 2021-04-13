import { IPolygon } from '../geometry/polygon';
import { World } from '../stateModel';
import { IActionHandler } from './actions';
import { removeVertex } from '../geometry/geometry';
import { isEdge, isVertex, SelectableElement } from '../geometry/selectable';
import { IVertex } from '../geometry/vertex';
import { ipcRenderer } from 'electron';
import undoService from './undoService';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import { clearSelection } from '../store/selection';

const dispatch = useAppDispatch();

export class GeometryRemover implements IActionHandler {
        
    private selectedElements: SelectableElement[] = [];
    
    constructor(private world: World) {
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
            this.selectedElements.forEach(s => {
                if (isVertex(s)) { 
                    this.removeVertex(s.vertex, s.polygon); 
                } else if (isEdge(s)) {
                    this.removeVertex(s.edge.start, s.polygon);                     
                } else {
                    s.polygon.vertices.forEach(v => this.removeVertex(v, s.polygon));
                }
            });

            dispatch(clearSelection());
            undoService.push(this.world.geometry); 
        }
        
    }

    private removeVertex = (v: IVertex, p: IPolygon) => {
        this.world.geometry = removeVertex(v, p, this.world.geometry);               
    }
}