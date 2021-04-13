import { splitEdge } from './../geometry/geometry';
import { World } from '../stateModel';
import { ISpaceTranslator } from "./geometrySelector";
import { projectOn } from "../math/lineSegment";
import { IActionHandler } from "./actions";
import { Vector } from '../math/vector';
import { drawVector } from '../drawing/drawing';
import { isEdge, SelectableElement, SelectedEdge } from '../geometry/selectable';
import { ipcRenderer } from 'electron';
import undoService from '../actions/undoService';
import { connect } from '../store/store-connector';

export class EdgeSplitter implements IActionHandler {

    private isSplitting: boolean;
    private candidate: Vector;
    private selectedElements: SelectableElement[] = [];
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator,        
        private world: World) {
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

        const c = this.calculateCut(event);        
        this.world.geometry = splitEdge(c, this.selectedEdge.edge, this.selectedEdge.polygon, this.world.geometry);
        undoService.push(this.world.geometry);

        // stop cutting (even if keys are still pressed)
        this.cancel();
        return true;
    };

    private calculateCut = (event: MouseEvent): Vector => {
        const target = this.spaceTranslator.toWorldSpace(event);
        return projectOn(target, this.selectedEdge.edge.segment);
    }    
}
