import { ITextureReference } from './../textures/model';
import { Guid } from 'guid-typescript';
import { World } from "../stateModel";
import { IActionHandler } from "./actions";
import { IEdge } from '../geometry/edge';
import { isEdge, isPolygon } from "../geometry/selectable";
import { TextureLibrary } from '../textures/textureLibrary';
import { ipcRenderer } from 'electron';


export class EdgeModifier implements IActionHandler {
    
    constructor(private world: World, private texLib: TextureLibrary) {}

    private get selectedEdges(): IEdge[] { 
        return Array.from(new Set<IEdge>(this.world.selection
            .filter(isEdge).map(_=>_.edge)
            .concat(...this.world.selection
                .filter(isPolygon).map(_=>_.polygon.edges))));
    }

    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_edge_immaterial', this.toggleImmateriality);
        ipcRenderer.on('geometry_edge_texture', this.toggleTexture);
        ipcRenderer.on('geometry_edge_texture_scroll', (_, dir) => dir<0 ? this.previousTexture() : this.nextTexture());
        ipcRenderer.on('geometry_edge_translucency', (_, dir) => dir<0 ? this.increaseTranslucency() : this.decreaseTranslucency());
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
    private previousTexture = () => this.changeTexture(this.texLib.previous);
    private nextTexture = () => this.changeTexture(this.texLib.next);
    private changeTexture = (dir: (ITextureReference)=>ITextureReference) => {
        this.selectedEdges.filter(s => s.material.texture).forEach(_=> {
            if ('index' in _.material.texture) _.material.texture = dir(_.material.texture);
            else {
                _.material.texture = ({index: 0, id: this.texLib.textures[0].path});
            }
        });
    }
    private increaseTranslucency = () => {
        this.selectedEdges.forEach(_=>_.material.color[3] = Math.max(0, _.material.color[3] - 0.1));
    };  
    private decreaseTranslucency = () => {
        this.selectedEdges.forEach(_=>_.material.color[3] = Math.min(1, _.material.color[3] + 0.1));
    };  
    
}
