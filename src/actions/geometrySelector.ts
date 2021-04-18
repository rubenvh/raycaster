import { selectedElement } from './../geometry/selectable';
import { IActionHandler } from './actions';
import { detectCollisionAt, EMPTY_GEOMETRY, selectRegion } from '../geometry/geometry';
import { Vector } from '../math/vector';
import { BoundingBox } from '../geometry/polygon';
import { drawBoundingBox } from '../drawing/drawing';
import { SelectableElement } from '../geometry/selectable';
import { useAppDispatch } from '../store';
import { addSelectedElement, clearSelection, startNewSelection } from '../store/selection';
import { connect } from '../store/store-connector';

const dispatch = useAppDispatch();

export class GeometrySelector implements IActionHandler {    
    private isDragging: boolean;
    private region: BoundingBox;
    private wallGeometry = EMPTY_GEOMETRY;
    
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator, private blockingHandlers: IActionHandler[] = []) {    
            connect(s => {               
                this.wallGeometry = s.walls.geometry;
            });
        }
    
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
        
        const collision = detectCollisionAt(location, this.wallGeometry);
        
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
        
        const elements = selectRegion(region, this.wallGeometry);

        this.performSelection(event, elements);
        return true;
    };

    private performSelection = (event: MouseEvent, ss: SelectableElement[]) => {        
        if (!event.ctrlKey) dispatch(clearSelection());
        if (!ss || ss.length === 0) return;         
        dispatch(!event.ctrlKey ? startNewSelection(ss) : addSelectedElement(ss));        
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
