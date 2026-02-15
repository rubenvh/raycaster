import { isEdge, isPolygon, isVertex, SelectableElement } from '../selection/selectable';
import { IPolygon } from '../geometry/polygon';
import { IActionHandler } from './actions';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { clearSelection } from '../store/selection';
import { IGeometry } from '../geometry/geometry';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class PolygonTransformer implements IActionHandler {

    private selectedElements: SelectableElement[] = [];
    private wallGeometry: IGeometry;
    private unsubscribe: () => void;

    constructor() {
        this.unsubscribe = connect(s => {
            this.selectedElements = s.selection.elements;
            this.wallGeometry = s.walls.geometry;
        });
    }

    private get selectedPolygonIds(): string[] {
        return [...new Set(
            this.selectedElements
                .filter(el => isPolygon(el) || isEdge(el) || isVertex(el))
                .map(el => el.polygon.id)
        )];
    }

    private get hasPolygonSelection(): boolean {
        return this.selectedPolygonIds.length > 0;
    }

    register(g: GlobalEventHandlers): IActionHandler {
        window.electronAPI.on('geometry_polygon_flip_h', this.flipHorizontal);
        window.electronAPI.on('geometry_polygon_flip_v', this.flipVertical);
        window.electronAPI.on('geometry_polygon_scale_up', this.scaleUp);
        window.electronAPI.on('geometry_polygon_scale_down', this.scaleDown);
        window.electronAPI.on('geometry_polygon_regularize', this.regularize);
        window.electronAPI.on('geometry_polygon_convex_hull', this.convexHull);
        window.electronAPI.on('geometry_polygon_inset', this.insetPolygon);
        window.electronAPI.on('geometry_polygon_merge', this.mergePolygons);
        window.electronAPI.on('geometry_polygon_align_top', this.alignTop);
        window.electronAPI.on('geometry_polygon_align_bottom', this.alignBottom);
        window.electronAPI.on('geometry_polygon_align_left', this.alignLeft);
        window.electronAPI.on('geometry_polygon_align_right', this.alignRight);
        window.electronAPI.on('geometry_polygon_align_center_h', this.alignCenterH);
        window.electronAPI.on('geometry_polygon_align_center_v', this.alignCenterV);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_polygon_flip_h', this.flipHorizontal);
        window.electronAPI.off('geometry_polygon_flip_v', this.flipVertical);
        window.electronAPI.off('geometry_polygon_scale_up', this.scaleUp);
        window.electronAPI.off('geometry_polygon_scale_down', this.scaleDown);
        window.electronAPI.off('geometry_polygon_regularize', this.regularize);
        window.electronAPI.off('geometry_polygon_convex_hull', this.convexHull);
        window.electronAPI.off('geometry_polygon_inset', this.insetPolygon);
        window.electronAPI.off('geometry_polygon_merge', this.mergePolygons);
        window.electronAPI.off('geometry_polygon_align_top', this.alignTop);
        window.electronAPI.off('geometry_polygon_align_bottom', this.alignBottom);
        window.electronAPI.off('geometry_polygon_align_left', this.alignLeft);
        window.electronAPI.off('geometry_polygon_align_right', this.alignRight);
        window.electronAPI.off('geometry_polygon_align_center_h', this.alignCenterH);
        window.electronAPI.off('geometry_polygon_align_center_v', this.alignCenterV);
    }

    handle(_deltaTime: number): void {}
    isActive = (): boolean => true;

    private flipHorizontal = () => {
        if (!this.hasPolygonSelection) return;
        dispatch(actions.flipPolygon({ polygons: this.selectedPolygonIds, axis: 'horizontal' }));
    };

    private flipVertical = () => {
        if (!this.hasPolygonSelection) return;
        dispatch(actions.flipPolygon({ polygons: this.selectedPolygonIds, axis: 'vertical' }));
    };

    private scaleUp = () => {
        if (!this.hasPolygonSelection) return;
        dispatch(actions.scalePolygon({ polygons: this.selectedPolygonIds, scaleX: 1.1, scaleY: 1.1 }));
    };

    private scaleDown = () => {
        if (!this.hasPolygonSelection) return;
        dispatch(actions.scalePolygon({ polygons: this.selectedPolygonIds, scaleX: 0.9, scaleY: 0.9 }));
    };

    private regularize = () => {
        const ids = this.selectedPolygonIds;
        if (ids.length !== 1) return;
        dispatch(actions.regularizePolygon({ polygon: ids[0] }));
    };

    private convexHull = () => {
        const ids = this.selectedPolygonIds;
        if (ids.length !== 1) return;
        dispatch(actions.convexHull({ polygon: ids[0] }));
    };

    private insetPolygon = () => {
        const ids = this.selectedPolygonIds;
        if (ids.length !== 1) return;
        dispatch(actions.insetPolygon({ polygon: ids[0], distance: 10 }));
    };

    private mergePolygons = () => {
        const ids = this.selectedPolygonIds;
        if (ids.length < 2) return;
        dispatch(clearSelection());
        dispatch(actions.mergePolygons({ polygons: ids }));
    };

    private alignTop = () => this.align('top');
    private alignBottom = () => this.align('bottom');
    private alignLeft = () => this.align('left');
    private alignRight = () => this.align('right');
    private alignCenterH = () => this.align('center-h');
    private alignCenterV = () => this.align('center-v');

    private align = (direction: 'top' | 'bottom' | 'left' | 'right' | 'center-h' | 'center-v') => {
        const ids = this.selectedPolygonIds;
        if (ids.length < 2) return;
        dispatch(actions.alignPolygons({ polygons: ids, direction }));
    };
}
