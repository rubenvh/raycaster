import { detectCollisionAt, EdgeCollision, VertexCollision } from './geometry';
import { Vector } from './vector';
import { World, SelectableElement } from './world';

export class GeometrySelector {    
    private spaceTranslator: ISpaceTranslator;
    constructor(private canvas: HTMLCanvasElement, private world: World,) {
        this.spaceTranslator = spaceTranslator(canvas);
    }

    start = () => {
        this.canvas.addEventListener('contextmenu', this.selectElement, false);
    };

    private selectElement = (event: MouseEvent) => {
        const location = this.spaceTranslator.toWorldSpace(event);                
        const collision = detectCollisionAt(location, this.world.geometry);
        if (!event.ctrlKey) this.world.selection.length = 0;
        if (!collision) return;
        let s = selectedElement(collision);
        let i = this.world.selection.indexOf(s);
    
        if (i === -1) {               
            this.world.selection.push(s);
        } else {
            this.world.selection.splice(i, 1);
        }
    };
}

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

const selectedElement = (collision : VertexCollision|EdgeCollision): SelectableElement => {
    return collision.kind === "edge"? collision.edge : collision.vertex;
}