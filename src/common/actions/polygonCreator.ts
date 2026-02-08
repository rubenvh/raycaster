import { isPolygon, SelectableElement } from '../selection/selectable';
import { drawSegment, drawVector } from './../drawing/drawing';
import { snap, Vector } from '../math/vector';
import { areClose } from '../geometry/vertex';
import { IActionHandler } from './actions';
import { ISpaceTranslator } from './geometrySelector';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import { clonePolygon, createPolygon } from '../store/walls';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();
export class PolygonCreator implements IActionHandler {
    private isCreating: boolean = false;
    private emergingPolygon: Vector[] = [];
    private nextVertex: Vector;
    private selectedElements: SelectableElement[] = [];
    private duplicationCount: number = 0;

    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            connect(s => {
                if (this.selectedElements !== s.selection.elements) {
                    this.selectedElements = s.selection.elements;
                    this.duplicationCount = 0;
                }
            });
    }

    register(g: GlobalEventHandlers): IActionHandler {
        window.electronAPI.on('geometry_polygon_clone', this.duplicatePolygon);
        window.electronAPI.on('geometry_polygon_create', this.startCreation);        
        g.addEventListener('mousemove', this.prepareNextVertex);
        g.addEventListener('mouseup', this.decideNextVertex);
        g.addEventListener('contextmenu', this.cancel, false); 
        return this;
    }

    handle(): void {
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
    private startCreation = () => this.isCreating = this.canActivate();
    private canActivate = () => this.selectedElements.length === 0;
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
            this.cancel();
        }
        
        return true;
    };

    private duplicatePolygon = () => {        
        let oldPolygonSelection = this.selectedElements.filter(isPolygon);        
        dispatch(clonePolygon({
            polygons: oldPolygonSelection.map(x => x.polygon), 
            displacementIndex: ++this.duplicationCount
        }));        
    }
}