import { IPolygon } from '../geometry/polygon';
import { World } from '../stateModel';
import { IActionHandler } from './actions';
import { removeVertex } from '../geometry/geometry';
import { isEdge, isVertex } from '../geometry/selectable';
import { IVertex } from '../geometry/vertex';
import { ipcRenderer } from 'electron';

export class GeometryRemover implements IActionHandler {
        
    constructor(      
        private world: World) {
    }

    register(g: GlobalEventHandlers): IActionHandler {        
        ipcRenderer.on('geometry_remove', this.deleteSelection);
        return this;
    }

    handle(): void {}

    public isActive = () => this.world.selection.length > 0;
    
    private deleteSelection = () => {
        if (this.isActive()) {
            this.world.selection.forEach(s => {
                if (isVertex(s)) { 
                    this.removeVertex(s.vertex, s.polygon); 
                } else if (isEdge(s)) {
                    this.removeVertex(s.edge.start, s.polygon);                     
                } else {
                    s.polygon.vertices.forEach(v => this.removeVertex(v, s.polygon));
                }
            });

            this.world.selection = [];    
        }
        
    }

    private removeVertex = (v: IVertex, p: IPolygon) => {
        this.world.geometry = removeVertex(v, p, this.world.geometry);        
    }
}