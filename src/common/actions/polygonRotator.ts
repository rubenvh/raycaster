import { isPolygon, SelectableElement } from '../selection/selectable';
import { IPolygon } from "../geometry/polygon";
import { IActionHandler } from "./actions";
import { ISpaceTranslator } from "./geometrySelector";
import { ipcRenderer } from 'electron';
import { drawSegment, drawVector } from '../drawing/drawing';
import { EMPTY_GEOMETRY, rotatePolygon } from '../geometry/geometry';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { Vector } from '../math/vector';

const dispatch = useAppDispatch();
export class PolygonRotator implements IActionHandler {
    
    private isRotating: boolean;
    private candidates: IPolygon[] = [];
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
   
    private get selectedPolygons(): IPolygon[] {
        return this.selectedElements.filter(isPolygon).map(_ => _.polygon);
    }

    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_polygon_rotate', this.startRotation);
        g.addEventListener('mousemove', this.selectRotation);
        g.addEventListener('mouseup', this.finalizeRotation);
        g.addEventListener('contextmenu', this.cancel, false); 
        return this;
    }

    handle(): void {
        if (this.isActive() && this.candidates.length > 0) {
            this.candidates.forEach(p => {
                p.edges.forEach(e => drawSegment(this.context, e.segment, 'rgba(255, 150, 10, 0.7)'));
                p.vertices.forEach((v, i) => drawVector(this.context, v.vector, i === 0 ? 'rgba(50, 255, 10, 0.7)' : 'rgba(255, 150, 10, 0.7)'));
            });            
        }
    }     
    public isActive = () => this.isRotating;
    private startRotation = () => this.isRotating = this.canActivate();
    private canActivate = () => this.selectedPolygons.length >= 1;
    private cancel = () => {
        this.isRotating = false;
        this.candidates = [];
    }

    private selectRotation = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }        
        const selectedPolygonIds = this.selectedPolygons.map(_ => _.id);        
        const newGeometry = rotatePolygon(this.selectedPolygons.map(x => x.id), this.calculateRotation(event), this.wallGeometry);
        this.candidates = newGeometry.polygons.filter(p => selectedPolygonIds.includes(p.id));
        return true;
    };    

    private finalizeRotation = (event: MouseEvent): boolean => {
        if (event.button !== 0) { return false; }
        if (!this.isActive()) { return false; }
        event.stopImmediatePropagation();
        dispatch(actions.rotatePolygon({polygons: this.selectedPolygons.map(x => x.id), rotation: this.calculateRotation(event)}));
        this.cancel();
        return true;
    };

    private calculateRotation = (event: MouseEvent): Vector => this.spaceTranslator.toWorldSpace(event);        
}