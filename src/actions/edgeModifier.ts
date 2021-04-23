import { useAppDispatch } from './../store/index';
import { IEntityKey } from './../geometry/entity';
import { getMaterial, setTexture } from './../geometry/properties';
import { ITextureReference } from './../textures/model';
import { IActionHandler } from "./actions";
import { IEdge } from '../geometry/edge';
import { isEdge, isPolygon, SelectableElement } from "../selection/selectable";
import { TextureLibrary } from '../textures/textureLibrary';
import { ipcRenderer } from 'electron';
import { applyTexture, Face, toggleTexture } from '../geometry/properties';
import { connect } from '../store/store-connector';
import { adaptEdges } from '../store/walls';

const dispatch = useAppDispatch();
export class EdgeModifier implements IActionHandler {
    
    private selectedElements: SelectableElement[] = [];
    
    constructor(private texLib: TextureLibrary) {
        connect(s => {
            this.selectedElements = s.selection.elements;    
        });
    }
   
    private get selectedEdges(): Map<IEntityKey, IEdge[]> {
        return this.selectedElements.reduce((acc, s) => 
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
        
    private toggleImmateriality = () => this.adaptEdges(_ => {
        _.immaterial = !_.immaterial;
        return _;
    });
    private toggleMaterialTexture = () => this.adaptEdges(_ => { 
        _.material = applyTexture(Face.interior, _.material, {id: this.texLib.textures[0].path, index: 0}, toggleTexture);
        return _;
    });
    private previousTexture = () => this.changeTexture(this.texLib.previous);
    private nextTexture = () => this.changeTexture(this.texLib.next);
    private changeTexture = (dir: (ITextureReference)=>ITextureReference) => {
        this.adaptEdges(_ => {
            // TODO: are we adapting exterior/interior (or both) material => depend on specific key modifier            
            const m = getMaterial(Face.interior, _.material);
            if (!m) { return; }

            _.material = applyTexture(Face.interior, _.material, dir(m.texture), setTexture);
            return _;
        });};

    private increaseTranslucency = () => this.adaptEdges(_ => this.changeColor(-0.1, x => Math.max(0, x), _));
    private decreaseTranslucency = () => this.adaptEdges(_ => this.changeColor(0.1,  x => Math.min(1, x), _));
    private changeColor = (dir: number, guard: (number) => number, edge: IEdge) => {
        const m = getMaterial(Face.interior, edge.material);
        if (!m) return;
        m.color[3] = guard(m.color[3] + dir);
        return edge;
    }

    private adaptEdges = (transformer: (_: IEdge) => IEdge) => dispatch(adaptEdges({edgeMap: this.selectedEdges, transformer}));
}
