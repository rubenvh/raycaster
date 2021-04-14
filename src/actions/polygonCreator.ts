import { duplicatePolygons } from './../geometry/geometry';
import { isPolygon, SelectableElement } from './../geometry/selectable';
import { drawSegment, drawVector } from './../drawing/drawing';
import { snap, Vector } from '../math/vector';
import { areClose } from '../geometry/vertex';
import { World } from '../stateModel';
import { IActionHandler } from './actions';
import { ISpaceTranslator } from './geometrySelector';
import { addPolygon } from '../geometry/geometry';
import { createPolygon } from '../geometry/polygon';
import { ipcRenderer } from 'electron';
import undoService from './undoService';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import { startNewSelection } from '../store/selection';

const dispatch = useAppDispatch();
export class PolygonCreator implements IActionHandler {
    private isCreating: boolean;
    private emergingPolygon: Vector[] = [];
    private nextVertex: Vector;
    private selectedElements: SelectableElement[] = [];
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator,        
        private world: World) {
            connect(s => {
                this.selectedElements = s.selection.elements;
            });
    }
    

    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_polygon_clone', this.duplicatePolygon);
        ipcRenderer.on('geometry_polygon_create', this.startCreation);        
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
            this.world.geometry = addPolygon(createPolygon(this.emergingPolygon), this.world.geometry);
            undoService.push(this.world.geometry);
            this.cancel();
        }
        
        return true;
    };

    private duplicatePolygon = () => {        
        let oldPolygonSelection = this.selectedElements.filter(isPolygon);
        let newPolygons = [];
        [this.world.geometry, newPolygons] = duplicatePolygons(
            oldPolygonSelection.map(x => x.polygon), [10,10], this.world.geometry);

        dispatch(startNewSelection([
                 ...this.selectedElements.filter(s => !isPolygon(s) || !oldPolygonSelection.includes(s)),
                 ...newPolygons.map(p => ({kind: 'polygon', polygon: p} as const))
            ]));

        undoService.push(this.world.geometry);
    }
}