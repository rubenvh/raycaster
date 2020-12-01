import { ActiveActions } from "./actionHandler";
import { ISpaceTranslator, spaceTranslator } from "./geometrySelector";
import { midpoint } from "./lineSegment";
import { Vector, subtract, add, copyIn } from "./vector";
import { IEdge, segmentFrom } from "./vertex";
import { SelectableElement, World } from "./world";

interface ISelectionTransformer {
    eventListeners: {[key in keyof HTMLElementEventMap]: (event: MouseEvent) => boolean};
}

class EdgeSplitter implements ISelectionTransformer {
    
    eventListeners: { [key in keyof HTMLElementEventMap]: (event: MouseEvent) => boolean; } = {} as any;

    constructor(
        private spaceTranslator: ISpaceTranslator, 
        private selectedGeometry: SelectableElement[],
        private actions: ActiveActions ) {
        
        this.eventListeners['mousemove'] = this.selectCut;
        this.eventListeners['mouseup'] = this.cutEdge;
    }

    private isActive = () => this.actions.add_geometry && this.selectedGeometry.length === 1 && (this.selectedGeometry[0] as any).start;
    private get edge(): IEdge {
        return this.selectedGeometry[0] as IEdge;
    }
    private selectCut = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }

        const target = this.spaceTranslator.toWorldSpace(event);
        const candidate = midpoint(segmentFrom(this.edge));

        // TODO: calculate projection of target on edge and delegate to geometry: add to candidate geometry element list (on geometry, so it can be drawn)
        console.log('deciding cut candidate at', target, this.actions);

        return true;
    }

    private cutEdge = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }

        // TODO: calculate projection of target on edge and delegate to geometry: split edge => replace edge with 2 edges and add vertex 
        console.log('add vertex to geometry', this.spaceTranslator.toWorldSpace(event));
        return true;
    }
}
class GeometryMover implements ISelectionTransformer {
    private isDragging: boolean;
    private origin: Vector;

    eventListeners: { [key in keyof HTMLElementEventMap]: (event: MouseEvent) => boolean; } = {} as any;

    constructor(private spaceTranslator: ISpaceTranslator, private selectedGeometry: SelectableElement[] ) {
        this.eventListeners['mousedown'] = this.dragStart;
        this.eventListeners['mousemove'] = this.drag;
        this.eventListeners['mouseup'] = this.dragStop;
    }
    
    private dragStart = (event: MouseEvent): boolean => {
        if (event.button !== 0) return false; // left mouse click
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

        // TODO: refactor this using typescript type checks
        this.selectedGeometry.forEach((e: any) => {
            if (e.vector) {                    
                copyIn(e.vector, this.snap(event.ctrlKey, add(e.vector, delta)));
            } 
            else if (e.start && e.end) {
                if (!this.selectedGeometry.includes(e.start)) copyIn(e.start.vector, this.snap(event.ctrlKey, add(e.start.vector, delta)));                
                if (!this.selectedGeometry.includes(e.end)) copyIn(e.end.vector, this.snap(event.ctrlKey, add(e.end.vector, delta)));
            }
        });        

        // calculate new origin for next drag operation
        this.origin = add(this.origin, delta);
        return true;
    }

    private snap = (isSnapping: boolean, vector: Vector) => isSnapping ? [this.roundToGrid(vector[0]), this.roundToGrid(vector[1])] : vector;
    private roundToGrid = (value: number) => Math.round(value / 20) * 20;    
}
export class GeometryModifier {
    
    private transformers: ISelectionTransformer[];
    
    constructor(private canvas: HTMLCanvasElement, private world: World, private actions: ActiveActions) {
        const t = spaceTranslator(canvas);

        this.transformers = [
            new GeometryMover(t, this.world.selection),
            new EdgeSplitter(t, this.world.selection, this.actions),
        ];
    }

    start = (): GeometryModifier => {  
        this.transformers.forEach(t => 
            Object.keys(t.eventListeners).forEach(k => 
                this.canvas.addEventListener(k, t.eventListeners[k], false)));
        return this;
    };        
}