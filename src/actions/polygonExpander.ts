import { EMPTY_GEOMETRY, expandPolygon } from './../geometry/geometry';
import { IPolygon } from './../geometry/polygon';
import { ipcRenderer } from "electron";
import { isEdge, SelectableElement, SelectedEdge } from "../selection/selectable";
import { IActionHandler } from "./actions";
import { ISpaceTranslator } from "./geometrySelector";
import { drawSegment, drawVector } from '../drawing/drawing';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';

const dispatch = useAppDispatch();
export class PolygonExpander implements IActionHandler {
    
    private isExpanding: boolean;
    private candidate: IPolygon;
    private selectedElements: SelectableElement[] = [];
    private wallGeometry = EMPTY_GEOMETRY;
    
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            connect(s => {                
                this.selectedElements = s.selection.elements;
                this.wallGeometry = s.walls.geometry;
            });
        }
   
    private get selectedEdge(): SelectedEdge {
        return this.selectedElements.length === 1 ? this.selectedElements.filter(isEdge)[0] : null;
    }

    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_polygon_expand', this.startExpanding);
        g.addEventListener('mousemove', this.selectExpansion);
        g.addEventListener('mouseup', this.finalizeExpansion);
        g.addEventListener('contextmenu', this.cancel, false); 
        return this;
    }

    handle(): void {
        if (this.isActive() && this.candidate) {
            this.candidate.edges.forEach(e => drawSegment(this.context, e.segment, 'rgba(255, 150, 10, 0.7)'));
            this.candidate.vertices.forEach(v => drawVector(this.context, v.vector, 'rgba(255, 150, 10, 0.7)'));
        }
    }     
    public isActive = () => this.isExpanding;
    private startExpanding = () => this.isExpanding = this.canActivate();
    private canActivate = () => this.selectedElements.length === 1 && isEdge(this.selectedElements[0]);
    private cancel = () => {
        this.isExpanding = false;
        this.candidate = null;
    }

    private selectExpansion = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }        
        [this.candidate, ] = expandPolygon(this.selectedEdge.edge, this.selectedEdge.polygon.id, this.calculateTarget(event), this.wallGeometry);
        return true;
    };    

    private finalizeExpansion = (event: MouseEvent): boolean => {
        if (event.button !== 0) { return false; }
        if (!this.isActive()) { return false; }
        event.stopImmediatePropagation();        
        dispatch(actions.expandPolygon({edge: this.selectedEdge.edge, polygon: this.selectedEdge.polygon.id, direction: this.calculateTarget(event)}))        
        this.cancel();
        return true;
    };

    private calculateTarget = (event: MouseEvent) => this.spaceTranslator.toWorldSpace(event);
}