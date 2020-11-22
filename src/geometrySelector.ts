import { Collision, detectCollisionAt, EdgeCollision, VertexCollision } from './geometry';
import { World, SelectableElement } from './world';

export class GeometrySelector {
    private elemLeft: number;
    private elemTop: number;
    constructor(private canvas: HTMLCanvasElement, private world: World,) {
        this.elemLeft = canvas.offsetLeft + canvas.clientLeft;
        this.elemTop = canvas.offsetTop + canvas.clientTop;      
    }

    start = () => {
        this.canvas.addEventListener('click', (event: MouseEvent) => {
            const x = event.pageX - this.elemLeft,
                  y = event.pageY - this.elemTop;
        
            const collision = detectCollisionAt([x, y], this.world.geometry);
            // TODO: makeVector                    
            //const vertex = detectVertexAt([x, y], this.world.geometry);            
            if (!event.ctrlKey) this.world.selection.length = 0;
            if (!collision) return;
            let s = selectedElement(collision);
            let i = this.world.selection.indexOf(s);

            if (i === -1) {               
                this.world.selection.push(selectedElement(collision));
            } else {
                this.world.selection.splice(i, 1);
            }
        }, false);
    };
}

const selectedElement = (collision : VertexCollision|EdgeCollision): SelectableElement => {
    return collision.kind === "edge"? collision.edge : collision.vertex;
}