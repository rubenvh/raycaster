import { ISpaceTranslator, spaceTranslator } from "./geometrySelector";
import { Vector, subtract, add, copyIn } from "./vector";
import { World } from "./world";

export class GeometryModifier {
    private spaceTranslator: ISpaceTranslator;
    private isDragging: boolean;
    private origin: Vector;
    
    constructor(private canvas: HTMLCanvasElement, private world: World,) {
        this.spaceTranslator = spaceTranslator(canvas);
    }

    start = (): GeometryModifier => {        
        this.canvas.addEventListener('mousedown', this.dragStart, false);
        this.canvas.addEventListener('mousemove', this.drag, false);
        this.canvas.addEventListener('mouseup', this.dragStop, false);
        return this;
    };     

    private dragStart = (event: MouseEvent) => {
        if (event.button !== 0) return;
        this.isDragging = true;
        this.origin = this.spaceTranslator.toWorldSpace(event);
    };
    private drag = (event: MouseEvent) => {
        if (this.isDragging) {
            this.move(event);
        }
    };
    private dragStop = (event: MouseEvent) => {
        if (this.isDragging) {
            this.isDragging = false;
            this.move(event);
        }        
    };

    private move = (event: MouseEvent) => {
        const destination = this.spaceTranslator.toWorldSpace(event);            
        let delta = this.snap(event.ctrlKey, subtract(destination, this.origin));        

        // TODO: when multiselecting vertex and edge that has vertex as start or end then vertex is moved twice 
        // TODO: refactor this using typescript type checks
        this.world.selection.forEach((e: any) => {
            if (e.vector) {                    
                copyIn(e.vector, this.snap(event.ctrlKey, add(e.vector, delta)));
            } 
            else if (e.start && e.end) {
                copyIn(e.start.vector, this.snap(event.ctrlKey, add(e.start.vector, delta)));
                copyIn(e.end.vector, this.snap(event.ctrlKey, add(e.end.vector, delta)));
            }
        });        

        // calculate new origin for next drag operation
        this.origin = add(this.origin, delta);
    }

    
    private snap = (isSnapping: boolean, vector: Vector) => isSnapping ? [this.roundToGrid(vector[0]), this.roundToGrid(vector[1])] : vector;
    private roundToGrid = (value: number) => Math.round(value / 20) * 20;    
}