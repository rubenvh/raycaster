import { EMPTY_GEOMETRY, expandPolygon } from './../geometry/geometry';
import { IPolygon } from './../geometry/polygon';
import { isEdge, isGroup, isPolygon, isVertex, SelectableElement } from "../selection/selectable";
import { IActionHandler } from "./actions";
import { ISpaceTranslator } from "./geometrySelector";
import { drawSegment, drawVector } from '../drawing/drawing';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { clearSelection } from '../store/selection';
import { IEdge } from '../geometry/edge';
import { IEntityKey } from '../geometry/entity';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();
export class PolygonExpander implements IActionHandler {
    
    private isExpanding: boolean;
    private candidate: IPolygon;
    private selectedElements: SelectableElement[] = [];
    private wallGeometry = EMPTY_GEOMETRY;
    private unsubscribe: () => void;
    private registeredElement: GlobalEventHandlers | null = null;
    
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            this.unsubscribe = connect(s => {                
                this.selectedElements = s.selection.elements;
                this.wallGeometry = s.walls.geometry;
            });
        }
   
    private get selectedElement(): SelectableElement | null {
        return this.selectedElements.length === 1 ? this.selectedElements[0] : null;
    }

    private get selectedPolygonId(): IEntityKey | null {
        const el = this.selectedElement;
        if (!el || isGroup(el)) return null;
        return el.polygon.id;
    }

    private get selectedEdgeOrNull(): IEdge | null {
        const el = this.selectedElement;
        return el && isEdge(el) ? el.edge : null;
    }

    register(g: GlobalEventHandlers): IActionHandler {
        this.registeredElement = g;
        window.electronAPI.on('geometry_polygon_expand', this.startExpanding);
        g.addEventListener('mousemove', this.selectExpansion);
        g.addEventListener('mouseup', this.finalizeExpansion);
        g.addEventListener('contextmenu', this.cancel, false);
        window.addEventListener('keydown', this.handleKeyDown, false);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_polygon_expand', this.startExpanding);
        window.removeEventListener('keydown', this.handleKeyDown, false);
        if (this.registeredElement) {
            this.registeredElement.removeEventListener('mousemove', this.selectExpansion);
            this.registeredElement.removeEventListener('mouseup', this.finalizeExpansion);
            this.registeredElement.removeEventListener('contextmenu', this.cancel, false);
        }
    }

    handle(_deltaTime: number): void {
        if (this.isActive() && this.candidate) {
            this.candidate.edges.forEach(e => drawSegment(this.context, e.segment, 'rgba(255, 150, 10, 0.7)'));
            this.candidate.vertices.forEach(v => drawVector(this.context, v.vector, 'rgba(255, 150, 10, 0.7)'));
        }
    }
    public isActive = () => this.isExpanding;
    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isExpanding) {
            this.cancel();
        }
    };
    private startExpanding = () => this.isExpanding = this.canActivate();
    private canActivate = () => {
        const el = this.selectedElement;
        return el != null && (isEdge(el) || isVertex(el) || isPolygon(el));
    }
    private cancel = () => {
        this.isExpanding = false;
        this.candidate = null;
    }

    private selectExpansion = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }        
        [this.candidate, ] = expandPolygon(this.selectedEdgeOrNull, this.selectedPolygonId, this.calculateTarget(event), this.wallGeometry);
        return true;
    };

    private finalizeExpansion = (event: MouseEvent): boolean => {
        if (event.button !== 0) { return false; }
        if (!this.isActive()) { return false; }
        event.stopImmediatePropagation();                
        const expansionRequest = {edge: this.selectedEdgeOrNull, polygon: this.selectedPolygonId, direction: this.calculateTarget(event)};
        dispatch(clearSelection());
        dispatch(actions.expandPolygon(expansionRequest));        
        this.cancel();
        return true;
    };

    private calculateTarget = (event: MouseEvent) => this.spaceTranslator.toWorldSpace(event);
}