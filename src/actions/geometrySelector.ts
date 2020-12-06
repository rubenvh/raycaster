import { IActionHandler } from './actions';
import { detectCollisionAt, EdgeCollision, VertexCollision } from '../geometry/geometry';
import { Vector } from '../geometry/vector';
import { World, SelectableElement } from '../world';

export class GeometrySelector implements IActionHandler {    

    constructor(private spaceTranslator: ISpaceTranslator, private world: World) {}

    register(g: GlobalEventHandlers): IActionHandler {
        g.addEventListener('contextmenu', this.selectElement, false);        
        return this;
    }

    handle(): void {}
    
    private selectElement = (event: MouseEvent) => {
        const location = this.spaceTranslator.toWorldSpace(event);                
        const collision = detectCollisionAt(location, this.world.geometry);
        if (!event.ctrlKey) this.world.selection.length = 0;
        if (!collision) return;
        let s = selectedElement(collision, event.shiftKey);
        let i = this.world.selection.indexOf(s);
        
        if (i === -1) {               
            this.world.selection.push(s);
        } else {
            this.world.selection.splice(i, 1);
        }
    };
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
    if (selectPolygon) { return ({kind: 'polygon', polygon: collision.polygon})};
    return collision.kind === 'edge' 
    ? ({kind: collision.kind, edge: collision.edge, polygon: collision.polygon }) 
    : ({kind: collision.kind, vertex: collision.vertex, polygon: collision.polygon });
}