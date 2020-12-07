import { isEdge, isPolygon } from './../world';
import { World } from "../world";
import { bindCallbackToKey, IActionHandler } from "./actions";
import { IEdge } from '../geometry/vertex';

export class EdgeModifier implements IActionHandler {
    
    constructor(private world: World) {}

    private get selectedGeometry() { return this.world.selection; }
    private get selectedEdges(): IEdge[] { 
        return this.world.selection.filter(isEdge).map(_=>_.edge).concat(...this.world.selection.filter(isPolygon).map(_=>_.polygon.edges));
    }

    register(g: GlobalEventHandlers): IActionHandler {
        bindCallbackToKey(window, 'geo_change_immateriality', this.toggleImmateriality);
        bindCallbackToKey(window, 'geo_change_translucency_down', this.decreaseTranslucency);
        bindCallbackToKey(window, 'geo_change_translucency_up', this.increaseTranslucency);
        return this;
    }

    handle(): void {}
    
    private toggleImmateriality = () => {
        this.selectedEdges.forEach(_=>_.immaterial = !_.immaterial );        
    };    
    private increaseTranslucency = () => {
        this.selectedEdges.forEach(_=>_.material.color[3] = Math.max(0, _.material.color[3] - 0.1));
    };  
    private decreaseTranslucency = () => {
        this.selectedEdges.forEach(_=>_.material.color[3] = Math.min(1, _.material.color[3] + 0.1));
    };  
    
}
