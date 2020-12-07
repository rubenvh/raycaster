import { drawSegment, drawVector } from './../drawing/drawing';
import { createPolygon, IVertex } from './../geometry/vertex';
import { snap, Vector } from '../geometry/vector';
import { areClose } from '../geometry/vertex';
import { World } from '../world';
import { bindCallbackToKey, Flag, IActionHandler } from './actions';
import { ISpaceTranslator } from './geometrySelector';
import { addPolygon } from '../geometry/geometry';
export class PolygonCreator implements IActionHandler {
    private isCreating: boolean;
    private emergingPolygon: Vector[] = [];
    private nextVertex: Vector;
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator,        
        private world: World) {
    }
    

    register(g: GlobalEventHandlers): IActionHandler {
        bindCallbackToKey(window, 'geo_add', this.startCreation);                
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

    private startCreation = () => this.isCreating = this.isActive();
    private isActive = () => this.world.selection.length === 0;
    private cancel = () => {
        this.isCreating = false;
        this.nextVertex = null;
        this.emergingPolygon = [];
    }
    private prepareNextVertex = (event: MouseEvent): boolean => {
        if (event.button)
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
            this.cancel();
        }
        
        return true;
    };
}