import { ISpaceTranslator } from "./geometrySelector";
import { midpoint } from "../lineSegment";
import { IEdge, segmentFrom } from "../vertex";
import { SelectableElement } from "../world";
import { bindFlagToKey, Flag, IActionHandler } from "./actions";

export class EdgeSplitter implements IActionHandler {

    active: Flag = { value: false };
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

    private isActive = () => this.active.value && this.selectedGeometry.length === 1 && (this.selectedGeometry[0] as any).start;
    private get edge(): IEdge {
        return this.selectedGeometry[0] as IEdge;
    }
    private selectCut = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }

        const target = this.spaceTranslator.toWorldSpace(event);
        const candidate = midpoint(segmentFrom(this.edge));

        // TODO: calculate projection of target on edge and delegate to geometry: add to candidate geometry element list (on geometry, so it can be drawn)
        console.log('deciding cut candidate at', target, this.active);

        return true;
    };

    private cutEdge = (event: MouseEvent): boolean => {
        if (!this.isActive()) { return false; }

        // TODO: calculate projection of target on edge and delegate to geometry: split edge => replace edge with 2 edges and add vertex 
        console.log('add vertex to geometry', this.spaceTranslator.toWorldSpace(event));

        // TODO: this does not work obviously as the keydown listener still makes the flag true
        // maybe we should have an extra property on flag that is put to true only the first time the key is pressed
        // and set it to false here
        this.active.value = false;
        return true;
    };
}
