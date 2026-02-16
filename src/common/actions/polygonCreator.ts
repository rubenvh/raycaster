import { isPolygon, SelectableElement, selectPolygon } from '../selection/selectable';
import { drawSegment, drawVector } from './../drawing/drawing';
import { snap, Vector } from '../math/vector';
import { areClose } from '../geometry/vertex';
import { IActionHandler } from './actions';
import { ISpaceTranslator } from './geometrySelector';
import { connect } from '../store/store-connector';
import store, { useAppDispatch } from '../store';
import { clonePolygon, createPolygon } from '../store/walls';
import { clearSelection, startNewSelection } from '../store/selection';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();
export class PolygonCreator implements IActionHandler {
    private isCreating: boolean = false;
    private emergingPolygon: Vector[] = [];
    private nextVertex: Vector;
    private selectedElements: SelectableElement[] = [];
    private duplicationCount: number = 0;
    private unsubscribe: () => void;
    private registeredElement: GlobalEventHandlers | null = null;

    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            this.unsubscribe = connect(s => {
                if (this.selectedElements !== s.selection.elements) {
                    this.selectedElements = s.selection.elements;
                    this.duplicationCount = 0;
                }
            });
    }

    register(g: GlobalEventHandlers): IActionHandler {
        this.registeredElement = g;
        window.electronAPI.on('geometry_polygon_clone', this.duplicatePolygon);
        window.electronAPI.on('geometry_polygon_create', this.startCreation);        
        g.addEventListener('mousemove', this.prepareNextVertex);
        g.addEventListener('mouseup', this.decideNextVertex);
        g.addEventListener('contextmenu', this.cancel, false);
        window.addEventListener('keydown', this.handleKeyDown, false);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_polygon_clone', this.duplicatePolygon);
        window.electronAPI.off('geometry_polygon_create', this.startCreation);
        window.removeEventListener('keydown', this.handleKeyDown, false);
        if (this.registeredElement) {
            this.registeredElement.removeEventListener('mousemove', this.prepareNextVertex);
            this.registeredElement.removeEventListener('mouseup', this.decideNextVertex);
            this.registeredElement.removeEventListener('contextmenu', this.cancel, false);
        }
    }

    handle(_deltaTime: number): void {
        if (this.isCreating) {
            
            if (this.emergingPolygon.length > 0) {
                let last = this.emergingPolygon.reduce((acc, v) =>  {                
                    drawVector(this.context, v);                
                    if (acc) { drawSegment(this.context, [acc, v]); }
                    return v;
                }, null as Vector);            
    
                drawSegment(this.context, [last, this.nextVertex]);
            }
            if (this.nextVertex) drawVector(this.context, this.nextVertex);
        } 
    }

    public isActive = () => this.isCreating;
    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isCreating) {
            this.cancel();
        }
    };
    private startCreation = () => {
        // Clear any existing selection so polygon creation can start from any state
        dispatch(clearSelection());
        this.isCreating = true;
    };
    private cancel = () => {
        this.isCreating = false;
        this.nextVertex = null;
        this.emergingPolygon = [];
    }
    private prepareNextVertex = (event: MouseEvent): boolean => {
        if (event.button !== 0) { return false; }
        if (!this.isCreating) { return false; }
        const v = this.spaceTranslator.toWorldSpace(event);
        this.nextVertex = event.ctrlKey ? snap(v) : v;
        return true;
    };    

    private decideNextVertex = (event: MouseEvent): boolean => {
        if (!this.isCreating) { return false; }

        this.emergingPolygon.push(this.nextVertex);
        if (this.emergingPolygon.length > 2 && areClose(this.emergingPolygon[0], this.emergingPolygon[this.emergingPolygon.length-1], 5)) {          
            dispatch(createPolygon(this.emergingPolygon));
            // Select the newly created polygon (it's the last one in the geometry)
            const geometry = store.getState().walls.geometry;
            const newPolygon = geometry.polygons[geometry.polygons.length - 1];
            if (newPolygon) {
                dispatch(startNewSelection({ elements: [selectPolygon(newPolygon)], geometry }));
            }
            this.cancel();
        }
        
        return true;
    };

    private duplicatePolygon = () => {        
        let oldPolygonSelection = this.selectedElements.filter(isPolygon);
        if (oldPolygonSelection.length === 0) return;
        dispatch(clonePolygon({
            polygons: oldPolygonSelection.map(x => x.polygon), 
            displacementIndex: ++this.duplicationCount
        }));
        // Select the newly cloned polygons (they are appended at the end of the polygon list)
        const geometry = store.getState().walls.geometry;
        const cloneCount = oldPolygonSelection.length;
        const newPolygons = geometry.polygons.slice(-cloneCount);
        dispatch(startNewSelection({
            elements: newPolygons.map(p => selectPolygon(p)),
            geometry
        }));
    }
}