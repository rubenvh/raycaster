import { IBSPNode, isLeafNode, isSplitNode } from './geometry/bsp/model';
import { connect } from './store/store-connector';
import { ICamera, makeRays, DEFAULT_CAMERA } from './camera';
import { drawSegment, drawVector, drawBoundingBox, drawPlane } from './drawing/drawing';
import { IEdge } from './geometry/edge';
import { EMPTY_GEOMETRY, IGeometry } from './geometry/geometry';
import { isSelectedEdge, isSelectedPolygon, isSelectedVertex, SelectableElement, selectedId } from './selection/selectable';
import { IVertex } from './geometry/vertex';
import { add, perpendicular, subtract } from './math/vector';
import { midpoint, normal } from './math/lineSegment';

export class MapEditorRenderer {
    private _context: CanvasRenderingContext2D;
    private background: HTMLCanvasElement;
    private selectedElements: SelectableElement[] = [];
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private selectedTreeNode: SelectableElement;
    private active: boolean = false;
    
    get context(): CanvasRenderingContext2D {
        return this._context;
    }
    
    constructor(private canvas: HTMLCanvasElement) {
        this._context = canvas.getContext('2d');
        this.background = document.createElement('canvas') as HTMLCanvasElement;
        this.resizeCanvas();        
        window.addEventListener('resize', e => {
            e.preventDefault();  
            this.resizeCanvas();
        });
        connect(s => {
            this.selectedElements = s.selection.elements;
            this.selectedTreeNode = s.selection.treeSelection;
            this.camera = s.player.camera;
            this.wallGeometry = s.walls.geometry;
            this.active = !s.uiConfig.enableTestCanvas;            
        });
    }
   
    private resizeCanvas = (): void => {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.background.width = this.canvas.width;
        this.background.height = this.canvas.height;
        this.initGrid();
    }

    public render = (fps: number) => {
        if (this.active) {
            this._context.clearRect(0, 0, this.canvas.width, this.canvas.height);        
            this.drawGrid();
            this.drawCamera(this._context, this.camera);
            this.drawGeometry(this._context, this.wallGeometry);

            if (this.wallGeometry.bsp) {
                // TODO: create bps drawing toggle
                //this.drawBsp(this.wallGeometry.bsp);
            }
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
            const selected = isSelectedPolygon(p.id, this.selectedElements);            
            const highlighted = this.selectedTreeNode && selectedId(this.selectedTreeNode) === p.id;    
            drawBoundingBox(context, p.boundingBox,  highlighted ? Colors.POLYGON_HIGHLIGHTED : selected ? Colors.POLYGON_SELECTED : Colors.POLYGON);            
            p.edges.forEach(e => this.drawEdge(context, e, selected));
            p.vertices.forEach(e => this.drawVertex(context, e, selected));
        });
    };

    private drawEdge = (context: CanvasRenderingContext2D, edge: IEdge, selected: boolean = false) => {
        selected = selected || isSelectedEdge(edge.id, this.selectedElements);    
        const highlighted = this.selectedTreeNode && selectedId(this.selectedTreeNode) === edge.id;    
        const color = highlighted ? Colors.HIGHLIGHTED : selected ? Colors.EDGE_SELECTED : edge.immaterial ? Colors.IMMATERIAL : Colors.EDGE;
        const width = selected||highlighted ? 2 : 1;
        
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

    private initGrid = () => {        
        this.background.width = this.canvas.width;
        this.background.height = this.canvas.height;        
        const backgroundContext = this.background.getContext('2d');
        backgroundContext.beginPath();
        backgroundContext.lineWidth = 1;
        backgroundContext.setLineDash([4, 2]);
        backgroundContext.strokeStyle = Colors.BLACK;
        for (let x = 0; x <= backgroundContext.canvas.width; x += 20) {
            backgroundContext.moveTo(x, 0);
            backgroundContext.lineTo(x, backgroundContext.canvas.height);
            for (let y = 0; y <= backgroundContext.canvas.height; y += 20) {
                backgroundContext.moveTo(0, y);
                backgroundContext.lineTo(backgroundContext.canvas.width, y);
            }
        }
        backgroundContext.stroke();
    };

    private colors: string[] = ['white', 'yellow', 'orange', 'red', 'purple', 'blue', 'cyan', 'green'];
    private drawBsp = (tree: IBSPNode, depth: number = 0) => {
        if (isSplitNode(tree)) {
            
            drawPlane(this._context, tree.plane, this.colors[depth]);

            this.drawBsp(tree.front, depth +1);
            this.drawBsp(tree.back, depth + 1 );
        }
    };
        
    private drawGrid = () => this._context.drawImage(this.background, 0, 0);
}

enum Colors {
    BLACK = 'rgb(0,0,0)',    
    HIGHLIGHTED = 'rgb(0,250,100)',
    IMMATERIAL = 'rgb(100,100,0)',
    CAMERA = 'grey',
    POLYGON = 'rgba(150,100,50,0.8)',
    POLYGON_SELECTED = 'rgba(255,100,0,0.8)',
    POLYGON_HIGHLIGHTED = 'rgba(0,250,100,0.8)',
    VERTEX = 'rgb(200,200,200)',
    VERTEX_SELECTED = 'rgb(255,100,0)',
    EDGE = 'rgb(175,175,125)',
    EDGE_SELECTED = 'rgb(210,80,10)',
}