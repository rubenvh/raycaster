import { SelectableElement } from './world';
import { Geometry } from "./geometry";

export class GeometrySelector {
    private elemLeft: number;
    private elemTop: number;
    constructor(private canvas: HTMLCanvasElement, private geometry: Geometry, private selection: SelectableElement[]) {
        this.elemLeft = canvas.offsetLeft + canvas.clientLeft;
        this.elemTop = canvas.offsetTop + canvas.clientTop;      
    }

    start = () => {
        this.canvas.addEventListener('click', (event: MouseEvent) => {
            const x = event.pageX - this.elemLeft,
                  y = event.pageY - this.elemTop;
        
            // TODO: makeVector
            const vertex = this.geometry.detectVertexAt([x, y]);            
            if (!event.ctrlKey) this.selection.length = 0;
            this.selection.push(vertex.vertex);        
        }, false);
    };
}