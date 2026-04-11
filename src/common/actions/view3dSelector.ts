import { IActionHandler } from './actions';
import { makeRayForColumn, ICamera, DEFAULT_CAMERA } from '../camera';
import { castVisibleRay } from '../rendering/raycasting/raycaster';
import { EMPTY_GEOMETRY, IGeometry } from '../geometry/geometry';
import { IBspContext } from '../store/bsp-state';
import { selectEdge, selectPolygon } from '../selection/selectable';
import { useAppDispatch } from '../store';
import { addSelectedElement, clearSelection, startNewSelection } from '../store/selection';
import { connect } from '../store/store-connector';
import { getResolution } from '../config/resolution';

const dispatch = useAppDispatch();

const RESOLUTION = getResolution();

export class View3dSelector implements IActionHandler {
    private camera: ICamera = DEFAULT_CAMERA;
    private wallGeometry: IGeometry = EMPTY_GEOMETRY;
    private bspContext: IBspContext | null = null;
    private unsubscribe: () => void;
    private registeredElement: GlobalEventHandlers | null = null;

    constructor(private canvas: HTMLCanvasElement) {
        this.unsubscribe = connect(s => {
            this.camera = s.player.camera;
            this.wallGeometry = s.walls.geometry;
            this.bspContext = { tree: s.bsp.treeHolder?.node ?? null, dirtyEdges: s.bsp.dirtyEdges };
        });
    }

    register(g: GlobalEventHandlers): IActionHandler {
        this.registeredElement = g;
        g.addEventListener('click', this.onClick);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        if (this.registeredElement) {
            this.registeredElement.removeEventListener('click', this.onClick);
        }
    }

    handle(_deltaTime: number): void {
        // No per-frame work needed
    }

    isActive(): boolean {
        return false;
    }

    private onClick = (event: MouseEvent): void => {
        if (event.button !== 0) return;

        const column = this.screenXToColumn(event.offsetX);
        if (column < 0 || column > RESOLUTION) return;

        const ray = makeRayForColumn(column, RESOLUTION, this.camera);
        const hit = castVisibleRay(ray, this.wallGeometry, this.bspContext);

        if (!hit || !hit.edge || !hit.intersection) return;

        // Resolve BSP tree references to geometry store objects. The BSP tree
        // holds its own edge/polygon copies that must remain mutable for in-place
        // material patching (see patchBspEdgeMaterials). Storing BSP references
        // directly in the selection slice would cause Immer to deep-freeze them,
        // breaking subsequent material patches.
        const geomPolygon = this.wallGeometry.polygons.find(p => p.id === hit.polygon?.id);
        if (!geomPolygon) return;

        const geomEdge = geomPolygon.edges.find(e => e.id === hit.edge.id);
        if (!geomEdge) return;

        const element = event.shiftKey
            ? selectPolygon(geomPolygon)
            : selectEdge(geomEdge, geomPolygon);

        if (event.ctrlKey) {
            dispatch(addSelectedElement({ elements: [element], geometry: this.wallGeometry }));
        } else {
            dispatch(clearSelection());
            dispatch(startNewSelection({ elements: [element], geometry: this.wallGeometry }));
        }
    };

    /**
     * Convert a screen pixel X coordinate to a ray column index.
     * The renderer maps columns right-to-left (column 0 = rightmost pixel),
     * so we invert: column = resolution * (1 - offsetX / canvasDisplayWidth)
     */
    private screenXToColumn(offsetX: number): number {
        const displayWidth = this.canvas.clientWidth;
        return Math.floor(RESOLUTION * (1 - offsetX / displayWidth));
    }
}
