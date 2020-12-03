import { ICamera, makeRays } from './camera';
import { ILineSegment } from './geometry/lineSegment';
import { getX, getY, Vector } from './geometry/vector';
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
                        this.drawVector(this.context, hit.intersection, 'rgb(0,255,0)');
                        if (rayIndex % (this.canvas.width/10) === 0) this.drawSegment(this.context, [hit.intersection, hit.ray.line[0]], 'green');
                    };
                });
            });
        }
    };

    private drawCamera = (context: CanvasRenderingContext2D, cam: ICamera) => {
        this.drawSegment(context, cam.screen, 'rgb(255,255,255)');
        makeRays(3, cam).forEach(r => {
            this.drawSegment(context, r.line, 'grey');
        });
    };

    private drawGeometry = (context: CanvasRenderingContext2D, geometry: IGeometry) => {
        geometry.polygons.forEach(p => {
            p.vertices.forEach(e => this.drawVertex(context, e));
            p.edges.forEach(e => this.drawEdge(context, e));
        });
    };

    private drawEdge = (context: CanvasRenderingContext2D, edge: IEdge) => {
        const color = hasEdge(edge, this.world.selection) ? 'rgb(250,100,0)' : 'rgb(255,255,255)';
        this.drawSegment(context, [edge.start.vector, edge.end.vector], color);
    };

    private drawSegment = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'white') => {
        context.beginPath();
        context.moveTo(getX(segment[0]), getY(segment[0]));
        context.lineTo(getX(segment[1]), getY(segment[1]));
        context.lineWidth = 1;
        context.setLineDash([]);
        context.strokeStyle = color;
        context.stroke();
    };

    private drawVertex = (context: CanvasRenderingContext2D, vertex: IVertex, color: string = 'rgb(100,100,0)') => {
        this.drawVector(context, vertex.vector, hasVertex(vertex, this.world.selection) ? 'rgb(250,100,0)' : color);
    };

    private drawVector = (context: CanvasRenderingContext2D, vector: Vector, color: string = 'rgb(100,100,0)') => {
        context.beginPath();
        context.arc(getX(vector), getY(vector), 2, 0, 2*Math.PI, false);
        context.fillStyle = color;
        context.fill();
    }

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
