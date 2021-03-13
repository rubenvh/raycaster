import { getMaterial, setTexture } from './../geometry/properties';
import { transformEdges } from './../geometry/geometry';
import { ITextureReference } from './../textures/model';
import { Guid } from 'guid-typescript';
import { World } from "../stateModel";
import { IActionHandler } from "./actions";
import { IEdge } from '../geometry/edge';
import { isEdge, isPolygon } from "../geometry/selectable";
import { TextureLibrary } from '../textures/textureLibrary';
import { ipcRenderer } from 'electron';
import undoService from './undoService';
import { applyTexture, Face, toggleTexture } from '../geometry/properties';


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
        ipcRenderer.on('geometry_edge_texture', this.toggleMaterialTexture);
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
    private toggleMaterialTexture = () => this.adaptEdges(_ => _.material = applyTexture(Face.interior, _.material, {id: this.texLib.textures[0].path, index: 0}, toggleTexture));
    private previousTexture = () => this.changeTexture(this.texLib.previous);
    private nextTexture = () => this.changeTexture(this.texLib.next);
    private changeTexture = (dir: (ITextureReference)=>ITextureReference) => {
        this.adaptEdges(_ => {
            // TODO: are we adapting exterior/interior (or both) material => depend on specific key modifier            
            const m = getMaterial(Face.interior, _.material);
            if (!m) { return; }

            _.material = applyTexture(Face.interior, _.material, dir(m.texture), setTexture);
        });};

    private increaseTranslucency = () => this.adaptEdges(_ => this.changeColor(-0.1, x => Math.max(0, x), _));
    private decreaseTranslucency = () => this.adaptEdges(_ => this.changeColor(0.1,  x => Math.min(1, x), _));
    private changeColor = (dir: number, guard: (number) => number, edge: IEdge) => {
        const m = getMaterial(Face.interior, edge.material);
        if (!m) return;
        m.color[3] = guard(m.color[3] + dir);
    }
}
