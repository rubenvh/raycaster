import { ISpaceTranslator } from "./geometrySelector";
import { Vector, subtract, add, snap } from "../math/vector";
import { isCloseToSelected, isEdge, isVertex, World } from "../world";
import { IActionHandler } from "./actions";
import { IVertex } from "../geometry/vertex";
import { Guid } from "guid-typescript";
import { moveVertices } from "../geometry/geometry";

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
        // left mouse click for moving
        if (event.button !== 0) { return false; }
        this.origin = this.spaceTranslator.toWorldSpace(event);        
        this.isDragging = this.world.selection.some(s => isCloseToSelected(this.origin, s));        
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
                
        const verticesByPolygon: Map<Guid, IVertex[]> = this.world.selection.reduce((acc, s) => {
            return acc.set(s.polygon.id, Array.from(new Set<IVertex>([...(acc.get(s.polygon.id)||[]).concat(
                isVertex(s)
                ? [s.vertex]
                : isEdge(s)
                ? [s.edge.start, s.edge.end]
                : s.polygon.vertices)])));
        }, new Map());
        
        this.world.geometry = moveVertices(event.ctrlKey, delta, verticesByPolygon, this.world.geometry);

        // calculate new origin for next drag operation
        this.origin = add(this.origin, delta);
        return true;
    };

    private snap = (isSnapping: boolean, vector: Vector) => isSnapping ? snap(vector) : vector;
}
