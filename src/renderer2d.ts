import { ICamera, makeRays } from './camera';
import { drawSegment, drawVector } from './drawing/drawing';
import { IEdge, IGeometry, IVertex } from './geometry/vertex';
import { hasEdge, hasVertex, World } from './world';

export class Renderer2d {
    private context: CanvasRenderingContext2D;
    private background: HTMLCanvasElement;

    constructor(private world: World, private canvas: HTMLCanvasElement) {
        this.context = canvas.getContext('2d');
        this.background = document.createElement('canvas') as HTMLCanvasElement;
        this.initGrid();
    }

    public render = (fps: number) => {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);        
        this.drawGrid();
        this.drawCamera(this.context, this.world.camera);
        this.drawGeometry(this.context, this.world.geometry);
        this.context.fillStyle = "rgb(255,255,255)";
        this.context.fillText('fps = ' + fps, this.canvas.height - 20, 10);

        if (this.world.rays) {
            this.world.rays.forEach((c, rayIndex) => {
                c.hits.forEach(hit => {
                    if (hit?.intersection) {
                        drawVector(this.context, hit.intersection, 'rgba(0,255, 0, 0.03)');
                        if (rayIndex % (this.canvas.width/10) === 0) drawSegment(this.context, [hit.intersection, hit.ray.line[0]], 'green');
                    };
                });
            });
        }
    };

    private drawCamera = (context: CanvasRenderingContext2D, cam: ICamera) => {
        drawSegment(context, cam.screen, 'rgb(255,255,255)');
        makeRays(3, cam).forEach(r => {
            drawSegment(context, r.line, 'grey');
        });
    };

    private drawGeometry = (context: CanvasRenderingContext2D, geometry: IGeometry) => {
        geometry.polygons.forEach(p => {
            p.vertices.forEach(e => this.drawVertex(context, e));
            p.edges.forEach(e => this.drawEdge(context, e));
        });
    };

    private drawEdge = (context: CanvasRenderingContext2D, edge: IEdge) => {
        const selected = hasEdge(edge, this.world.selection);
        const color = selected ? 'rgb(255,100,0)' : 'rgb(255,255,255)';
        const width = selected ? 2 : 1;
        drawSegment(context, [edge.start.vector, edge.end.vector], color, width);
    };
   

    private drawVertex = (context: CanvasRenderingContext2D, vertex: IVertex, color: string = 'rgb(100,100,0)') => {
        drawVector(context, vertex.vector, hasVertex(vertex, this.world.selection) ? 'rgb(250,100,0)' : color);
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
