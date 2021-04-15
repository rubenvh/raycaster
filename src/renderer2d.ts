import { connect } from './store/store-connector';
import { ICamera, makeRays, DEFAULT_CAMERA } from './camera';
import { drawSegment, drawVector, drawBoundingBox } from './drawing/drawing';
import { IEdge } from './geometry/edge';
import { IGeometry } from './geometry/geometry';
import { isSelectedEdge, isSelectedPolygon, isSelectedVertex, SelectableElement } from './geometry/selectable';
import { IVertex } from './geometry/vertex';
import { World } from './stateModel';

export class Renderer2d {
    private context: CanvasRenderingContext2D;
    private background: HTMLCanvasElement;
    private selectedElements: SelectableElement[] = [];
    private camera = DEFAULT_CAMERA;
    
    constructor(private world: World, private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.background = document.createElement('canvas') as HTMLCanvasElement;
        this.resizeCanvas();        
        window.addEventListener('resize', e => {
            e.preventDefault();  
            this.resizeCanvas();
        });
        connect(s => {
            this.selectedElements = s.selection.elements;
            this.camera = s.player.camera;
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
        this.drawGeometry(this.context, this.world.geometry);
                
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
        drawSegment(context, cam.screen, 'rgb(255,255,255)');
        makeRays(3, cam).forEach(r => {
            drawSegment(context, r.line, 'grey');
        });
    };

    private drawGeometry = (context: CanvasRenderingContext2D, geometry: IGeometry) => {
        
        geometry.polygons.forEach(p => {
            const selected = isSelectedPolygon(p.id, this.selectedElements);
            drawBoundingBox(context, p.boundingBox, selected ? 'rgb(255,100,0,0.8)' : 'rgb(150,100,50,0.8)');
            p.vertices.forEach(e => this.drawVertex(context, e, selected));
            p.edges.forEach(e => this.drawEdge(context, e, selected));
        });
    };

    private drawEdge = (context: CanvasRenderingContext2D, edge: IEdge, selected: boolean = false) => {
        selected = selected || isSelectedEdge(edge.id, this.selectedElements);        
        const color = selected ? 'rgb(255,100,0)' : edge.immaterial ? 'rgb(100,100,0)' : 'rgb(255,255,255)';
        const width = selected ? 2 : 1;
        drawSegment(context, [edge.start.vector, edge.end.vector], color, width);
    };
   

    private drawVertex = (context: CanvasRenderingContext2D, vertex: IVertex, selected: boolean = false) => {
        selected = selected || isSelectedVertex(vertex.id, this.selectedElements);
        drawVector(context, vertex.vector, selected ? 'rgb(250,100,0)' : 'rgb(100,100,0)');
    };    

    private initGrid = () => {        
        this.background.width = this.canvas.width;
        this.background.height = this.canvas.height;        
        const backgroundContext = this.background.getContext('2d');
        backgroundContext.beginPath();
        backgroundContext.lineWidth = 1;
        backgroundContext.setLineDash([4, 2]);
        backgroundContext.strokeStyle = 'rgb(0,0,0)';
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
