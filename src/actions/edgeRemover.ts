import { SelectedVertex } from './../world';
import { World } from '../world';
import { IActionHandler, Flag, bindCallbackToKey } from './actions';
import { removeVertex } from '../geometry/geometry';

export class VertexRemover implements IActionHandler {
    active: Flag = { value: false };
    
    constructor(      
        private world: World) {
    }

    private get selectedGeometry() { return this.world.selection; }
    private get selectedVertex(): SelectedVertex {
        return this.selectedGeometry[0].kind === 'vertex'
            ? this.selectedGeometry[0] 
            : null;
    }

    register(g: GlobalEventHandlers): IActionHandler {
        bindCallbackToKey(window, 'geo_remove', this.deleteVertex);        
        return this;
    }

    handle(): void {}

    private isActive = () => this.selectedGeometry.length === 1 && this.selectedVertex
    
    private deleteVertex = () => {
        if (this.isActive()) {
            const v = this.selectedVertex;
            this.world.geometry = removeVertex(this.selectedVertex.vertex, this.selectedVertex.polygon, this.world.geometry);
            this.world.selection = this.world.selection.filter(x => x!==v);            
        }
        
    }
}