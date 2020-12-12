import { IActionHandler } from './actions';
import { detectCollisionAt, selectRegion } from '../geometry/geometry';
import { Vector } from '../math/vector';
import { World } from '../world';
import { EdgeCollision, VertexCollision } from '../geometry/collision';
import { BoundingBox } from '../geometry/polygon';
import { drawBoundingBox } from '../drawing/drawing';
import { SelectableElement } from '../geometry/selectable';

export class GeometrySelector implements IActionHandler {    
    private isDragging: boolean;
    private region: BoundingBox;

    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator, private world: World) {}

    register(g: GlobalEventHandlers): IActionHandler {
        g.addEventListener('contextmenu', this.selectElement, false);    
        g.addEventListener('mousedown', this.dragStart);
        g.addEventListener('mousemove', this.drag);
        g.addEventListener('mouseup', this.dragStop);    
        return this;
    }

    handle(): void {
        if (this.isDragging) {
            drawBoundingBox(this.context, this.region, 'rgba(255,100,0,0.8)')
        }
    }
    
    private selectElement = (event: MouseEvent) => {
        const location = this.spaceTranslator.toWorldSpace(event);                
        const collision = detectCollisionAt(location, this.world.geometry);
        let s = selectedElement(collision, event.shiftKey);
        this.performSelection(event, [s]);
    };

    private dragStart = (event: MouseEvent): boolean => {
        // left mouse click for selecting region
        if (event.button !== 0) { return false; }
        const origin = this.spaceTranslator.toWorldSpace(event);        
        this.isDragging = true;
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
        // TODO: ask geometry for elements that are inside the bounding box

        const elements = selectRegion(region, this.world.geometry);

        this.performSelection(event, elements);
        return true;
    };

    private performSelection = (event: MouseEvent, ss: SelectableElement[]) => {
        if (!event.ctrlKey) this.world.selection.length = 0;
        if (!ss || ss.length === 0) return;
        
        ss.forEach(s => {
            let i = this.world.selection.indexOf(s);
        
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

const selectedElement = (collision : VertexCollision|EdgeCollision, selectPolygon: boolean): SelectableElement => {
    if (!collision) return null;
    if (selectPolygon) { return ({kind: 'polygon', polygon: collision.polygon})};
    return collision.kind === 'edge' 
    ? ({kind: collision.kind, edge: collision.edge, polygon: collision.polygon }) 
    : ({kind: collision.kind, vertex: collision.vertex, polygon: collision.polygon });
}