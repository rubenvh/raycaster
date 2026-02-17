import { isEdge, isVertex, SelectableElement, SelectedEdge, SelectedVertex } from '../selection/selectable';
import { IActionHandler } from './actions';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { clearSelection } from '../store/selection';
import { IGeometry } from '../geometry/geometry';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class EdgeOperations implements IActionHandler {

    private selectedElements: SelectableElement[] = [];
    private wallGeometry: IGeometry;
    private unsubscribe: () => void;

    constructor() {
        this.unsubscribe = connect(s => {
            this.selectedElements = s.selection.elements;
            this.wallGeometry = s.walls.geometry;
        });
    }

    private get selectedEdge(): SelectedEdge | null {
        const el = this.selectedElements.length === 1 ? this.selectedElements[0] : null;
        return el && isEdge(el) ? el : null;
    }

    private get selectedVertices(): SelectedVertex[] {
        return this.selectedElements.filter(isVertex);
    }

    register(g: GlobalEventHandlers): IActionHandler {
        window.electronAPI.on('geometry_edge_subdivide', this.subdivide);
        window.electronAPI.on('geometry_edge_inset', this.insetEdge);
        window.electronAPI.on('geometry_vertex_bevel', this.bevelVertex);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_edge_subdivide', this.subdivide);
        window.electronAPI.off('geometry_edge_inset', this.insetEdge);
        window.electronAPI.off('geometry_vertex_bevel', this.bevelVertex);
    }

    handle(_deltaTime: number): void {}
    isActive = (): boolean => true;

    private subdivide = () => {
        const sel = this.selectedEdge;
        if (!sel) return;
        dispatch(clearSelection());
        dispatch(actions.subdivideEdge({ edge: sel.edge, polygon: sel.polygon.id, segments: 3 }));
    };

    private insetEdge = () => {
        const sel = this.selectedEdge;
        if (!sel) return;
        dispatch(clearSelection());
        dispatch(actions.insetEdge({ edge: sel.edge, polygon: sel.polygon.id, depth: 10, splitRatio: 0.5 }));
    };

    private bevelVertex = () => {
        const sel = this.selectedVertices;
        if (sel.length === 0) return;
        dispatch(clearSelection());
        dispatch(actions.bevelVertex({ vertices: sel.map(s => ({vertex: s.vertex, polygon: s.polygon.id})), distance: 10, segments: 1 }));
    };
}
