import { Colors } from './colors';
import { BoundingBox } from '../geometry/polygon';
import { IBSPNode, isSplitNode } from '../geometry/bsp/model';
import { connect } from '../store/store-connector';
import { ICamera, makeRays, DEFAULT_CAMERA } from '../camera';
import { drawSegment, drawVector, drawBoundingBox, drawPlane } from '../drawing/drawing';
import { IEdge } from '../geometry/edge';
import { EMPTY_GEOMETRY, IGeometry } from '../geometry/geometry';
import { isSelectedEdge, isSelectedPolygon, isSelectedVertex, SelectableElement, selectedId } from '../selection/selectable';
import { IVertex } from '../geometry/vertex';
import { normal } from '../math/lineSegment';
import { CastingStats, EMPTY_STATS } from '../rendering/raycasting/raycaster';
import { IUIConfigState } from '../store/ui-config';
import { ISpaceTranslator } from '../actions/geometrySelector';
import { Vector } from '../math/vector';
import { ViewPort } from './viewport';

export class MapEditorRenderer implements ISpaceTranslator {

    private _context: CanvasRenderingContext2D;
    private selectedElements: SelectableElement[] = [];
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private selectedTreeNode: SelectableElement;
    private castingStats: CastingStats = EMPTY_STATS;
    private uiConfig: IUIConfigState = {};
    private scroll: ViewPort;

    elemLeft: number;
    elemTop: number;
    get context(): CanvasRenderingContext2D {
        return this._context;
    }

    constructor(private canvas: HTMLCanvasElement) {
        this._context = canvas.getContext('2d');
        this.scroll = new ViewPort(canvas);
        this.resizeCanvas();
        this.elemLeft = canvas.offsetLeft + canvas.clientLeft;
        this.elemTop = canvas.offsetTop + canvas.clientTop;

        window.addEventListener('resize', e => {
            e.preventDefault();
            this.resizeCanvas();
        });

        connect(s => {
            this.selectedElements = s.selection.elements;
            this.selectedTreeNode = s.selection.treeSelection;
            this.camera = s.player.camera;
            this.uiConfig = s.uiConfig;
            this.castingStats = s.stats.intersections.stats;

            if (s.walls.geometry !== this.wallGeometry) {
                this.wallGeometry = s.walls.geometry;
                this.scroll.setBounds(this.wallGeometry.bounds);
            }
        });
    }

    public toWorldSpace = (event: MouseEvent): Vector => this.scroll.toWorldSpace([event.pageX - this.elemLeft, event.pageY - this.elemTop]);

    private get active() {
        return !this.uiConfig.enableTestCanvas;
    }

    private resizeCanvas = (): void => {
        this.canvas.height = 0;
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.scroll.reset();
    }

    public render = (fps: number) => {
        if (this.active) {
            this.scroll.drawBackground();

            this.drawCamera(this._context, this.camera);
            this.drawGeometry(this._context, this.wallGeometry);

            if (this.wallGeometry.bsp && this.uiConfig.drawBsp) {
                this.drawBsp(this.wallGeometry.bsp);
            }

            this.scroll.drawForeground();
        }

        // if (this.world.rays?.length > 0) {
        //     this.world.rays.forEach((c, rayIndex) => {
        //         // c.hits.forEach(hit => {
        //         //     if (hit?.intersection) {
        //         //         drawVector(this.context, hit.intersection, 'rgba(0,255, 0, 0.03)');
        //         //         if (rayIndex % (this.canvas.width/10) === 0) drawSegment(this.context, [hit.intersection, hit.ray.line[0]], 'green');
        //         //     };
        //         // });
        //     });
        //}
    };

    private drawCamera = (context: CanvasRenderingContext2D, cam: ICamera) => {
        drawSegment(context, cam.screen, Colors.CAMERA);
        makeRays(3, cam).forEach(r => {
            drawSegment(context, r.line, Colors.CAMERA);
        });
    };

    private drawGeometry = (context: CanvasRenderingContext2D, geometry: IGeometry) => {
        geometry.polygons.forEach(p => {
            const tested = this.uiConfig.drawBsp && this.castingStats?.polygons?.has(p.id);
            const selected = isSelectedPolygon(p.id, this.selectedElements);
            const highlighted = this.selectedTreeNode && selectedId(this.selectedTreeNode) === p.id;
            drawBoundingBox(context, p.boundingBox, tested ? Colors.POLYGON_TESTED : highlighted ? Colors.POLYGON_HIGHLIGHTED : selected ? Colors.POLYGON_SELECTED : Colors.POLYGON);
            p.edges.forEach(e => this.drawEdge(context, e, selected));
            p.vertices.forEach(e => this.drawVertex(context, e, selected));
        });
    };

    private drawEdge = (context: CanvasRenderingContext2D, edge: IEdge, selected: boolean = false) => {
        selected = selected || isSelectedEdge(edge.id, this.selectedElements);
        const highlighted = this.selectedTreeNode && selectedId(this.selectedTreeNode) === edge.id;
        const color = highlighted ? Colors.HIGHLIGHTED : selected ? Colors.EDGE_SELECTED : edge.immaterial ? Colors.IMMATERIAL : Colors.EDGE;
        const width = selected || highlighted ? 2 : 1;

        if (selected) {
            // draw normal to selected edge:
            drawSegment(context, normal(edge.segment, 10), 'rgb(0,100,255)', 1);
        }
        drawSegment(context, [edge.start.vector, edge.end.vector], color, width);
    };

    private drawVertex = (context: CanvasRenderingContext2D, vertex: IVertex, selected: boolean = false) => {
        selected = selected || isSelectedVertex(vertex.id, this.selectedElements);
        const highlighted = this.selectedTreeNode && selectedId(this.selectedTreeNode) === vertex.id;
        drawVector(context, vertex.vector, highlighted ? Colors.HIGHLIGHTED : selected ? Colors.VERTEX_SELECTED : Colors.VERTEX);
    };

    private colors: string[] = ['white', 'yellow', 'orange', 'red', 'purple', 'blue', 'cyan', 'green'];
    private drawBsp = (tree: IBSPNode, depth: number = 0, clipRegion: Path2D[] = []) => {
        if (depth > 5) { return; }
        if (isSplitNode(tree)) {
            const bounds = this.scroll.toWorldSpace([this.canvas.width, this.canvas.height]);
            const [frontClip, backClip] = drawPlane(this._context, tree.plane, this.colors[depth], clipRegion, bounds);
            this.drawBsp(tree.front, depth + 1, clipRegion.concat(frontClip));
            this.drawBsp(tree.back, depth + 1, clipRegion.concat(backClip));
        }
    };
}

