import { SelectedEdge } from './../world';
import { ISpaceTranslator } from "./geometrySelector";
import { midpoint } from "../lineSegment";
import { IEdge, segmentFrom } from "../vertex";
import { SelectableElement } from "../world";
import { bindFlagToKey, deactivate, Flag, IActionHandler, isActive } from "./actions";
export class EdgeSplitter implements IActionHandler {

    active: Flag = { value: false, blockKeyDown: false };
    constructor(
        private spaceTranslator: ISpaceTranslator,
        private selectedGeometry: SelectableElement[]) {
    }
    register(g: GlobalEventHandlers): IActionHandler {
        bindFlagToKey(window, "add_geometry", this.active);
        g.addEventListener('mousemove', this.selectCut);
        g.addEventListener('mouseup', this.cutEdge);
        return this;
    }

    handle(): void {}

    private isActive = () => isActive(this.active) && this.selectedGeometry.length === 1 && (this.selectedGeometry[0].kind === 'edge');
    private get selectedEdge(): SelectedEdge {
        return this.selectedGeometry[0].kind === 'edge'
            ? this.selectedGeometry[0] 
            : null;
    }
    private selectCut = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }

        const target = this.spaceTranslator.toWorldSpace(event);
        const candidate = midpoint(segmentFrom(this.selectedEdge.edge));

        // TODO: calculate projection of target on edge and delegate to geometry: add to candidate geometry element list (on geometry, so it can be drawn)
        console.log('deciding cut candidate at', target, this.active);

        return true;
    };

    private cutEdge = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }

        // TODO: calculate projection of target on edge and delegate to geometry: split edge => replace edge with 2 edges and add vertex 
        console.log('add vertex to geometry', this.spaceTranslator.toWorldSpace(event));

        // stop cutting (even if keys are still pressed)
        deactivate(this.active);
        return true;
    };
}
