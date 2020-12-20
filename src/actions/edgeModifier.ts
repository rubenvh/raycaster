import { Guid } from 'guid-typescript';
import { World } from "../stateModel";
import { bindCallbackToKey, IActionHandler } from "./actions";
import { IEdge } from '../geometry/edge';
import { isEdge, isPolygon } from "../geometry/selectable";

export class EdgeModifier implements IActionHandler {
    
    constructor(private world: World) {}

    private get selectedEdges(): IEdge[] { 
        return Array.from(new Set<IEdge>(this.world.selection
            .filter(isEdge).map(_=>_.edge)
            .concat(...this.world.selection
                .filter(isPolygon).map(_=>_.polygon.edges))));
    }

    register(g: GlobalEventHandlers): IActionHandler {
        bindCallbackToKey(window, 'geo_change_immateriality', this.toggleImmateriality);
        bindCallbackToKey(window, 'geo_change_translucency_down', this.decreaseTranslucency);
        bindCallbackToKey(window, 'geo_change_translucency_up', this.increaseTranslucency);
        bindCallbackToKey(window, 'geo_texture_down', this.toggleTexture);
        return this;
    }

    handle(): void {}
    isActive = (): boolean => true;
    
    private toggleImmateriality = () => {        
        this.selectedEdges.forEach(_=>_.immaterial = !_.immaterial );        
    };   
    private toggleTexture = () => {        
        this.selectedEdges.forEach(_=>_.material.texture = !_.material.texture ? Guid.create() : null)
    };    
    private increaseTranslucency = () => {
        this.selectedEdges.forEach(_=>_.material.color[3] = Math.max(0, _.material.color[3] - 0.1));
    };  
    private decreaseTranslucency = () => {
        this.selectedEdges.forEach(_=>_.material.color[3] = Math.min(1, _.material.color[3] + 0.1));
    };  
    
}
