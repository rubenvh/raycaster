import { IGeometry, transformEdges } from './../geometry/geometry';
import { ITextureReference } from './../textures/model';
import { Guid } from 'guid-typescript';
import { World } from "../stateModel";
import { IActionHandler } from "./actions";
import { IEdge } from '../geometry/edge';
import { isEdge, isPolygon } from "../geometry/selectable";
import { TextureLibrary } from '../textures/textureLibrary';
import { ipcRenderer } from 'electron';
import undoService from './undoService';


export class EdgeModifier implements IActionHandler {
    
    constructor(private world: World, private texLib: TextureLibrary) {}
   
    private get selectedEdges(): Map<Guid, IEdge[]> {
        return this.world.selection.reduce((acc, s) => 
            acc.set(s.polygon.id, Array.from(new Set<IEdge>([...(acc.get(s.polygon.id)||[]).concat(
            isEdge(s)
                ? [s.edge]
                : isPolygon(s) ? s.polygon.edges 
                : [])]))), new Map());
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
    
    private adaptEdges = (transformer: (_: IEdge) => void) => {
        this.world.geometry = Array.from(this.selectedEdges.entries()).reduce((geo, [poligonId, edges]) => transformEdges(edges, poligonId, _ => {
            transformer(_);
            return _;
        }, geo), this.world.geometry);
        undoService.push(this.world.geometry);
    }
    private toggleImmateriality = () => this.adaptEdges(_ => _.immaterial = !_.immaterial);
    private toggleTexture = () => this.adaptEdges(_ => _.material.texture = !_.material.texture ? {id: this.texLib.textures[0].path, index: 0} : null);        
    private previousTexture = () => this.changeTexture(this.texLib.previous);
    private nextTexture = () => this.changeTexture(this.texLib.next);
    private changeTexture = (dir: (ITextureReference)=>ITextureReference) => {
        this.adaptEdges(_ => {
            // TODO: are we adapting exterior/interior (or both) material => depend on specific key modifier            
            if (!_.material?.texture) { return; }
            _.material.texture = dir(_.material.texture);
        });};
    private increaseTranslucency = () => this.adaptEdges(_ => _.material.color[3] = Math.max(0, _.material.color[3] - 0.1));
    private decreaseTranslucency = () => this.adaptEdges(_ => _.material.color[3] = Math.min(1, _.material.color[3] + 0.1));    
}
