import { ISpaceTranslator } from "./geometrySelector";
import { projectOn } from "../math/lineSegment";
import { IActionHandler } from "./actions";
import { Vector } from '../math/vector';
import { drawVector } from '../drawing/drawing';
import { isEdge, SelectableElement, SelectedEdge } from '../selection/selectable';
import { ipcRenderer } from 'electron';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import { splitEdge } from '../store/walls';

const dispatch = useAppDispatch();

export class EdgeSplitter implements IActionHandler {

    private isSplitting: boolean;
    private candidate: Vector;
    private selectedElements: SelectableElement[] = [];    
    
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            connect(s => {
                this.selectedElements = s.selection.elements;
            });
    }

    private get selectedGeometry() { return this.selectedElements; }
    private get selectedEdge(): SelectedEdge {
        return isEdge(this.selectedGeometry[0])
            ? this.selectedGeometry[0] 
            : null;
    }

    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_edge_split', this.startSplitting);        
        g.addEventListener('mousemove', this.selectCut);
        g.addEventListener('mouseup', this.cutEdge);
        g.addEventListener('contextmenu', this.cancel, false); 
        return this;
    }

    handle(): void {
        if (this.isActive() && this.candidate) drawVector(this.context, this.candidate, 'rgb(255,0,0)');
    }
        
    public isActive = () => this.isSplitting;
    private startSplitting = () => this.isSplitting = this.canActivate();
    private canActivate = () => this.selectedGeometry.length === 1 && isEdge(this.selectedGeometry[0]);
    private cancel = () => {
        this.isSplitting = false;
        this.candidate = null;
    }

    private selectCut = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }        
        this.candidate = this.calculateCut(event);
        return true;
    };    

    private cutEdge = (event: MouseEvent): boolean => {
        if (event.button !== 0) { return false; }
        if (!this.isActive()) { return false; }
        event.stopImmediatePropagation();
       
        dispatch(splitEdge({
            edge: this.selectedEdge.edge, 
            poligon: this.selectedEdge.polygon.id,
            target: this.spaceTranslator.toWorldSpace(event)
        }));

        // stop cutting (even if keys are still pressed)
        this.cancel();
        return true;
    };

    private calculateCut = (event: MouseEvent): Vector => {
        const target = this.spaceTranslator.toWorldSpace(event);
        return projectOn(target, this.selectedEdge.edge.segment);
    }    
}
