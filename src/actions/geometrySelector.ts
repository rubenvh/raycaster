import { isEdge, isPolygon, selectedElement } from './../geometry/selectable';
import { IActionHandler } from './actions';
import { detectCollisionAt, selectRegion } from '../geometry/geometry';
import { Vector } from '../math/vector';
import { World } from '../world';
import { EdgeCollision, VertexCollision } from '../geometry/collision';
import { BoundingBox } from '../geometry/polygon';
import { drawBoundingBox } from '../drawing/drawing';
import { isVertex, SelectableElement } from '../geometry/selectable';

export class GeometrySelector implements IActionHandler {    
    private isDragging: boolean;
    private region: BoundingBox;

    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator, private world: World, private blockingHandlers: IActionHandler[] = []) {}

    register(g: GlobalEventHandlers): IActionHandler {        
        g.addEventListener('mousedown', this.selectOrDrag);
        g.addEventListener('mousemove', this.drag);
        g.addEventListener('mouseup', this.dragStop);    
        return this;
    }

    handle(): void {
        if (this.isDragging) {
            drawBoundingBox(this.context, this.region, 'rgba(255,100,0,0.8)')
        }
    }

    isActive = (): boolean => this.isDragging;
    
    private trySelectElement = (location: Vector, event: MouseEvent): boolean => {
        
        const collision = detectCollisionAt(location, this.world.geometry);
        
        if (collision) {            
            let s = selectedElement(collision, event.shiftKey);
            this.performSelection(event, [s]);
        }
        return !!collision;        
    };

    private selectOrDrag = (event: MouseEvent): boolean => {        
        if (this.blockingHandlers.some(_ => _.isActive())) { return false; }
        // left mouse click for selecting region
        if (event.button !== 0) { return false; }        
        const origin = this.spaceTranslator.toWorldSpace(event);        
        this.isDragging = !this.trySelectElement(origin, event);
        this.region = [origin, origin];
        return true;
    };
    private drag = (event: MouseEvent): boolean => { 
        if (this.isDragging) this.region = this.growRegion(event);
        return true; 
    };
    private dragStop = (event: MouseEvent): boolean => {
        if (this.isDragging) {
            this.isDragging = false;
            this.selectRegion(this.growRegion(event), event);
            return true;
        }
        return false;
    };
    private growRegion = (event: MouseEvent): BoundingBox => {        
        return [this.region[0], this.spaceTranslator.toWorldSpace(event)];
    }
    private selectRegion = (region: BoundingBox, event: MouseEvent): boolean => {
        
        const elements = selectRegion(region, this.world.geometry);

        this.performSelection(event, elements);
        return true;
    };

    private performSelection = (event: MouseEvent, ss: SelectableElement[]) => {
        if (!event.ctrlKey) this.world.selection.length = 0;
        if (!ss || ss.length === 0) return;
        
        ss.forEach(s => {
            let i = this.world.selection.findIndex(_ => 
                isPolygon(_) && isPolygon(s) && _.polygon.id === s.polygon.id 
                || isVertex(_) && isVertex(s) && _.vertex.id === s.vertex.id
                || isEdge(_) && isEdge(s) && _.edge.id === s.edge.id);
        
            if (i === -1) {               
                this.world.selection.push(s);
            } else {
                this.world.selection.splice(i, 1);
            }    
        });        
    }
}

// TODO: these declarations belong somewhere else
export interface ISpaceTranslator {
    toWorldSpace: (event: MouseEvent) => Vector;
}
export const spaceTranslator = (canvas: HTMLCanvasElement): ISpaceTranslator => {
    const elemLeft = canvas.offsetLeft + canvas.clientLeft;
    const elemTop = canvas.offsetTop + canvas.clientTop;

    return {
        toWorldSpace: (event: MouseEvent): Vector => {
            return [event.pageX - elemLeft,
                event.pageY - elemTop];
        }
    }
}
