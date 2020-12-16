import { IPolygon } from './../geometry/polygon';
import { isPolygon } from './../geometry/selectable';
import { World } from '../world';
import { IActionHandler, Flag, bindCallbackToKey } from './actions';
import { removeVertex } from '../geometry/geometry';
import { isEdge, isVertex, SelectedVertex } from '../geometry/selectable';
import { IVertex } from '../geometry/vertex';

export class VertexRemover implements IActionHandler {
    active: Flag = { value: false };
    
    constructor(      
        private world: World) {
    }

    register(g: GlobalEventHandlers): IActionHandler {
        bindCallbackToKey(window, 'geo_remove', this.deleteVertex);        
        return this;
    }

    handle(): void {}

    public isActive = () => this.world.selection.length > 0;
    
    private deleteVertex = () => {
        if (this.isActive()) {

            this.world.selection.forEach(s => {
                if (isVertex(s)) { 
                    this.removeVertex(s.vertex, s.polygon); 
                } else if (isEdge(s)) {
                    this.removeVertex(s.edge.start, s.polygon); 
                    this.removeVertex(s.edge.end, s.polygon); 
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