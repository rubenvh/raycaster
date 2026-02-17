import { isVertex, isEdge, isPolygon, SelectableElement } from '../selection/selectable';
import { IActionHandler } from './actions';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { clearSelection } from '../store/selection';
import { IVertex, IVertexMap } from '../geometry/vertex';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class VertexOperations implements IActionHandler {

    private selectedElements: SelectableElement[] = [];
    private unsubscribe: () => void;

    constructor() {
        this.unsubscribe = connect(s => {
            this.selectedElements = s.selection.elements;
        });
    }

    private get selectedVertexMap(): IVertexMap {
        const map = new Map<string, IVertex[]>();
        this.selectedElements.forEach(el => {
            if (isVertex(el)) {
                const polyId = el.polygon.id;
                if (!map.has(polyId)) map.set(polyId, []);
                map.get(polyId)!.push(el.vertex);
            }
        });
        return map;
    }

    register(g: GlobalEventHandlers): IActionHandler {
        window.electronAPI.on('geometry_vertex_align_h', this.alignHorizontal);
        window.electronAPI.on('geometry_vertex_align_v', this.alignVertical);
        window.electronAPI.on('geometry_vertex_weld', this.weldVertices);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_vertex_align_h', this.alignHorizontal);
        window.electronAPI.off('geometry_vertex_align_v', this.alignVertical);
        window.electronAPI.off('geometry_vertex_weld', this.weldVertices);
    }

    handle(_deltaTime: number): void {}
    isActive = (): boolean => true;

    private alignHorizontal = () => {
        const map = this.selectedVertexMap;
        if (map.size === 0) return;
        dispatch(actions.alignVertices({ axis: 'horizontal', verticesMap: map }));
    };

    private alignVertical = () => {
        const map = this.selectedVertexMap;
        if (map.size === 0) return;
        dispatch(actions.alignVertices({ axis: 'vertical', verticesMap: map }));
    };

    private weldVertices = () => {
        const map = this.selectedVertexMap;
        if (map.size === 0) return;
        dispatch(clearSelection());
        dispatch(actions.weldVertices({ verticesMap: map }));
    };
}
