import { splitEdge } from './../geometry/geometry';
import { World } from './../world';
import { ISpaceTranslator } from "./geometrySelector";
import { projectOn } from "../math/lineSegment";
import { bindFlagToKey, deactivate, Flag, IActionHandler, isActive } from "./actions";
import { Vector } from '../math/vector';
import { drawVector } from '../drawing/drawing';
import { segmentFrom } from '../geometry/edge';
import { isEdge, SelectedEdge } from '../geometry/selectable';
export class EdgeSplitter implements IActionHandler {

    active: Flag = { value: false, blockKeyDown: false };
    private candidate: Vector;
    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator,        
        private world: World) {
    }

    private get selectedGeometry() { return this.world.selection; }
    private get selectedEdge(): SelectedEdge {
        return isEdge(this.selectedGeometry[0])
            ? this.selectedGeometry[0] 
            : null;
    }

    register(g: GlobalEventHandlers): IActionHandler {
        bindFlagToKey(window, 'geo_add', this.active);
        g.addEventListener('mousemove', this.selectCut);
        g.addEventListener('mouseup', this.cutEdge);
        return this;
    }

    handle(): void {
        if (this.isActive() && this.candidate) drawVector(this.context, this.candidate, 'rgb(255,0,0)');
    }
    
    isActive = () => isActive(this.active) && this.selectedGeometry.length === 1 && isEdge(this.selectedGeometry[0]);
    
    private selectCut = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }        
        this.candidate = this.calculateCut(event);
        return true;
    };    

    private cutEdge = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }
        event.stopImmediatePropagation();

        const c = this.calculateCut(event);
        this.world.geometry = splitEdge(c, this.selectedEdge.edge, this.selectedEdge.polygon, this.world.geometry);

        // stop cutting (even if keys are still pressed)
        deactivate(this.active);
        this.candidate = null;
        return true;
    };

    private calculateCut = (event: MouseEvent): Vector => {
        const target = this.spaceTranslator.toWorldSpace(event);
        return projectOn(target, segmentFrom(this.selectedEdge.edge));
    }
}
