import { ISpaceTranslator } from "./geometrySelector";
import { Vector, subtract, add, copyIn, snap } from "../geometry/vector";
import { SelectableElement, World } from "../world";
import { IActionHandler } from "./actions";
import { IVertex } from "../geometry/vertex";

export class GeometryMover implements IActionHandler {
    private isDragging: boolean;
    private origin: Vector;

    constructor(private spaceTranslator: ISpaceTranslator, private world: World) {
    }
    

    register(g: GlobalEventHandlers): IActionHandler {
        g.addEventListener('mousedown', this.dragStart);
        g.addEventListener('mousemove', this.drag);
        g.addEventListener('mouseup', this.dragStop);
        return this;
    }

    handle(): void {}    

    private dragStart = (event: MouseEvent): boolean => {
        if (event.button !== 0)
            return false; // left mouse click
        this.isDragging = true;
        this.origin = this.spaceTranslator.toWorldSpace(event);
        return true;
    };
    private drag = (event: MouseEvent): boolean => this.isDragging ? this.move(event) : true;
    private dragStop = (event: MouseEvent): boolean => {
        if (this.isDragging) {
            this.isDragging = false;
            this.move(event);
            return true;
        }
        return false;
    };

    private move = (event: MouseEvent): boolean => {
        const destination = this.spaceTranslator.toWorldSpace(event);
        let delta = this.snap(event.ctrlKey, subtract(destination, this.origin));
        
        // TODO: assemble list of vertices (with associated polygon) and delegate move operation into geometry.ts 
        // (make sure load polygon is called for adapted polygons so bounding box is recalculated)
        const movedVertices = Array.from(new Set<IVertex>(this.world.selection.reduce((acc, s) => {
            return (s.kind === 'vertex') 
                ? acc.concat(s.vertex)
                : (s.kind === 'edge') 
                ? acc.concat(s.edge.start, s.edge.end)
                : acc.concat(s.polygon.vertices);
        }, [])));

        movedVertices.forEach(v => copyIn(v.vector, this.snap(event.ctrlKey, add(v.vector, delta))));

        // calculate new origin for next drag operation
        this.origin = add(this.origin, delta);
        return true;
    };

    private snap = (isSnapping: boolean, vector: Vector) => isSnapping ? snap(vector) : vector;
}
