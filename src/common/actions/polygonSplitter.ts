import { IPolygon } from './../geometry/polygon';
import { isPolygon, SelectableElement } from '../selection/selectable';
import { IActionHandler } from './actions';
import { distance, IVertex } from '../geometry/vertex';
import { drawSegment, drawVector } from '../drawing/drawing';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { clearSelection } from '../store/selection';
import { ISpaceTranslator } from './geometrySelector';
import { Vector } from '../math/vector';

/// <reference path="../../renderer/electron.d.ts" />

const VERTEX_HIT_THRESHOLD = 10;

const dispatch = useAppDispatch();
export class PolygonSplitter implements IActionHandler {

    private isSplitting: boolean = false;
    private targetPolygon: IPolygon | null = null;
    private startVertex: IVertex | null = null;
    private hoveredVertex: IVertex | null = null;
    private mousePosition: Vector | null = null;
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

    register(g: GlobalEventHandlers): IActionHandler {
        this.registeredElement = g;
        window.electronAPI.on('geometry_polygon_split', this.startSplitting);
        g.addEventListener('mousemove', this.trackMouse);
        g.addEventListener('mouseup', this.selectVertex);
        g.addEventListener('contextmenu', this.cancel, false);
        window.addEventListener('keydown', this.handleKeyDown, false);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_polygon_split', this.startSplitting);
        window.removeEventListener('keydown', this.handleKeyDown, false);
        if (this.registeredElement) {
            this.registeredElement.removeEventListener('mousemove', this.trackMouse);
            this.registeredElement.removeEventListener('mouseup', this.selectVertex);
            this.registeredElement.removeEventListener('contextmenu', this.cancel, false);
        }
    }

    handle(_deltaTime: number): void {
        if (!this.isSplitting || !this.targetPolygon) return;

        const vertices = this.targetPolygon.vertices;

        // Draw all polygon edges dimmed to show context
        this.targetPolygon.edges.forEach(e =>
            drawSegment(this.context, e.segment, 'rgba(255, 150, 10, 0.3)'));

        // Draw vertices with appropriate colors
        vertices.forEach(v => {
            if (this.startVertex && v.id === this.startVertex.id) {
                // Start vertex in green
                drawVector(this.context, v.vector, 'rgba(50, 255, 10, 0.9)');
            } else if (this.hoveredVertex && v.id === this.hoveredVertex.id) {
                // Hovered valid target in bright orange
                drawVector(this.context, v.vector, 'rgba(255, 150, 10, 0.9)');
            } else if (this.startVertex && this.isAdjacentTo(v, this.startVertex)) {
                // Adjacent vertices (not valid targets) dimmed
                drawVector(this.context, v.vector, 'rgba(150, 150, 150, 0.4)');
            } else {
                // Selectable vertices in orange
                drawVector(this.context, v.vector, 'rgba(255, 150, 10, 0.7)');
            }
        });

        // Draw split preview line
        if (this.startVertex) {
            const endPoint = this.hoveredVertex
                ? this.hoveredVertex.vector
                : this.mousePosition;
            if (endPoint) {
                const color = this.hoveredVertex
                    ? 'rgba(255, 50, 50, 0.9)'
                    : 'rgba(255, 50, 50, 0.4)';
                drawSegment(this.context, [this.startVertex.vector, endPoint], color, 2);
            }
        }
    }

    public isActive = () => this.isSplitting;

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isSplitting) {
            this.cancel();
        }
    };

    private startSplitting = () => {
        if (!this.canActivate()) return;

        const selected = this.selectedElements.filter(isPolygon);
        this.targetPolygon = selected[0].polygon;
        this.isSplitting = true;
        this.startVertex = null;
        this.hoveredVertex = null;
        this.mousePosition = null;
    };

    private canActivate = (): boolean => {
        const polygons = this.selectedElements.filter(isPolygon);
        return polygons.length === 1;
    };

    private cancel = () => {
        this.isSplitting = false;
        this.targetPolygon = null;
        this.startVertex = null;
        this.hoveredVertex = null;
        this.mousePosition = null;
    };

    private trackMouse = (event: MouseEvent): boolean => {
        if (!this.isSplitting) return false;

        const worldPos = this.spaceTranslator.toWorldSpace(event);
        this.mousePosition = worldPos;

        // Find the nearest vertex of the target polygon within threshold
        this.hoveredVertex = this.findNearestVertex(worldPos);
        return true;
    };

    private selectVertex = (event: MouseEvent): boolean => {
        if (!this.isSplitting) return false;
        if (event.button !== 0) return false;

        if (!this.hoveredVertex) return false;

        if (!this.startVertex) {
            // First click: set the start vertex
            this.startVertex = this.hoveredVertex;
            this.hoveredVertex = null;
            return true;
        }

        // Second click: apply the split
        event.stopImmediatePropagation();
        const start = this.startVertex;
        const end = this.hoveredVertex;
        const polygonId = this.targetPolygon.id;

        dispatch(clearSelection());
        dispatch(actions.splitPolygon({ polygon: polygonId, start, end }));
        this.cancel();
        return true;
    };

    /**
     * Find the nearest vertex of the target polygon that is within the hit threshold
     * and is a valid selection target (non-adjacent to startVertex if one is set,
     * and not the startVertex itself).
     */
    private findNearestVertex(worldPos: Vector): IVertex | null {
        if (!this.targetPolygon) return null;

        let nearest: IVertex | null = null;
        let nearestDist = Infinity;

        for (const v of this.targetPolygon.vertices) {
            // Skip the start vertex itself
            if (this.startVertex && v.id === this.startVertex.id) continue;

            // Skip adjacent vertices when a start vertex is selected
            if (this.startVertex && this.isAdjacentTo(v, this.startVertex)) continue;

            const d = distance(v, worldPos);
            if (d <= VERTEX_HIT_THRESHOLD && d < nearestDist) {
                nearest = v;
                nearestDist = d;
            }
        }

        return nearest;
    }

    /**
     * Check whether two vertices are adjacent in the target polygon
     * (including wrap-around for the first and last vertex).
     */
    private isAdjacentTo(v1: IVertex, v2: IVertex): boolean {
        const vertices = this.targetPolygon.vertices;
        const i = vertices.findIndex(v => v.id === v1.id);
        const j = vertices.findIndex(v => v.id === v2.id);
        if (i === -1 || j === -1) return false;
        const diff = Math.abs(i - j);
        return diff === 1 || diff === vertices.length - 1;
    }
}
