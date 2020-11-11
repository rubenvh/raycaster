import { Geometry } from "./geometry";
import { Vector } from "./vector";

export class GeometryBuilder {
    private elemLeft: number;
    private elemTop: number;
    constructor(private canvas: HTMLCanvasElement, private geometry: Geometry) {
        this.elemLeft = canvas.offsetLeft + canvas.clientLeft;
        this.elemTop = canvas.offsetTop + canvas.clientTop;

       
    }

    start = () => {
        this.canvas.addEventListener('click', (event: MouseEvent) => {
            const x = event.pageX - this.elemLeft,
                  y = event.pageY - this.elemTop;
        
            console.log(new Vector(x, y));
            // Collision detection between clicked offset and element.
            //geometry.detectVertex(new Vertex(x, y));
            // geometry.forEach(function(element) {
            //     if (y > element.top && y < element.top + element.height 
            //         && x > element.left && x < element.left + element.width) {
            //         alert('clicked an element');
            //     }
            // });
        
        }, false);
    };
}