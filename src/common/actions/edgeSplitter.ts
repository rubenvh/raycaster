import { ISpaceTranslator } from "./geometrySelector";
import { projectOn } from "../math/lineSegment";
import { IActionHandler } from "./actions";
import { Vector } from '../math/vector';
import { drawVector } from '../drawing/drawing';
import { isEdge, SelectableElement, SelectedEdge } from '../selection/selectable';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import { splitEdge } from '../store/walls';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class EdgeSplitter implements IActionHandler {

    private isSplitting: boolean;
    private candidate: Vector;
    private selectedElements: SelectableElement[] = [];    
    private unsubscribe: () => void;
    private registeredElement: GlobalEventHandlers | null = null;
    
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            this.unsubscribe = connect(s => {
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
        this.registeredElement = g;
        window.electronAPI.on('geometry_edge_split', this.startSplitting);        
        g.addEventListener('mousemove', this.selectCut);
        g.addEventListener('mouseup', this.cutEdge);
        g.addEventListener('contextmenu', this.cancel, false); 
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_edge_split', this.startSplitting);
        if (this.registeredElement) {
            this.registeredElement.removeEventListener('mousemove', this.selectCut);
            this.registeredElement.removeEventListener('mouseup', this.cutEdge);
            this.registeredElement.removeEventListener('contextmenu', this.cancel, false);
        }
    }

    handle(_deltaTime: number): void {
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
