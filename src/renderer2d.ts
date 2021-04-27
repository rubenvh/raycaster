import { connect } from './store/store-connector';
import { ICamera, makeRays, DEFAULT_CAMERA } from './camera';
import { drawSegment, drawVector, drawBoundingBox } from './drawing/drawing';
import { IEdge } from './geometry/edge';
import { EMPTY_GEOMETRY, IGeometry } from './geometry/geometry';
import { isSelectedEdge, isSelectedPolygon, isSelectedVertex, SelectableElement, selectedId } from './selection/selectable';
import { IVertex } from './geometry/vertex';

export class Renderer2d {
    private context: CanvasRenderingContext2D;
    private background: HTMLCanvasElement;
    private selectedElements: SelectableElement[] = [];
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private selectedTreeNode: SelectableElement;
    
    constructor(private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
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
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);        
        this.drawGrid();
        this.drawCamera(this.context, this.camera);
        this.drawGeometry(this.context, this.wallGeometry);
                
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
        
    private drawGrid = () => this.context.drawImage(this.background, 0, 0);
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