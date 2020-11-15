import { detectVertexAt } from './geometry';
import { World } from './world';

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
        
            // TODO: makeVector                    
            const vertex = detectVertexAt([x, y], this.world.geometry);            
            if (!event.ctrlKey) this.world.selection.length = 0;
            this.world.selection.push(vertex.vertex);        
        }, false);
    };
}