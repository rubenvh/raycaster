import { ISpaceTranslator, spaceTranslator } from "./geometrySelector";
import { Vector, subtract } from "./vector";
import { World } from "./world";

export class GeometryModifier {
    private spaceTranslator: ISpaceTranslator;
    private isDragging: boolean;
    private origin: Vector;
    private destination: Vector;

    constructor(private canvas: HTMLCanvasElement, private world: World,) {
        this.spaceTranslator = spaceTranslator(canvas);
    }

    start = (): GeometryModifier => {        
        this.canvas.addEventListener('mousedown', this.dragStart, false);
        this.canvas.addEventListener('mousemove', this.drag, false);
        this.canvas.addEventListener('mouseup', this.dragStop, false);

        return this;
    };  
    
    draw = () => {
        // draw elements that are being moved
    }

    private dragStart = (event: MouseEvent) => {
        if (event.button !== 0) return;
        this.isDragging = true;
        this.origin = this.spaceTranslator.toWorldSpace(event);

    };
    private drag = (event: MouseEvent) => {
        if (this.isDragging) {
            const intermediateDestination = this.spaceTranslator.toWorldSpace(event);
            
            // make copy of selected elements (make vector from origin to intermediateDestination and apply to newly copied elements);        
        }
    };
    private dragStop = (event: MouseEvent) => {
        if (this.isDragging) {
            this.isDragging = false;
            this.destination = this.spaceTranslator.toWorldSpace(event);
    
            let delta = subtract(this.destination, this.origin);
            // TODO: snapping to grid depends on CTRL key pressed or not
            delta = [this.roundToGrid(delta[0]), this.roundToGrid(delta[1])];

            // TODO: refactor this using typescript type checks
            this.world.selection.forEach((e: any) => {
                if (e.vector) {                    
                    e.vector[0] += delta[0];
                    e.vector[1] += delta[1];
                } 
                else if (e.start && e.end) {
                    e.start.vector[0] += delta[0];
                    e.start.vector[1] += delta[1];
                    e.end.vector[0] += delta[0];
                    e.end.vector[1] += delta[1];
                }
            });            
        }
        
    };

    private roundToGrid(value: number) {
        return Math.floor(value / 20) * 20;
    }
}