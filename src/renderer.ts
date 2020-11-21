import { Renderer3d } from './renderer3d';
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { getX, getY } from "./vector";
import { ILineSegment } from "./lineSegment";
import { KeyBoardListener } from "./keyboard-listener";
import { ActionHandler, ActiveActions } from "./actionHandler";
import { World } from "./world";
import { createGeometry } from "./geometry";
import { GeometrySelector } from "./geometrySelector";
import { IGeometry, IVertex } from "./vertex";
import { ICamera, makeCamera, makeRays } from "./camera";

const ui = {    
    rotateButton: document.getElementById('rotate'),
    view_2d: {
        background: document.createElement('canvas') as HTMLCanvasElement,
        canvas: document.getElementById('view_2d') as HTMLCanvasElement
    },
    view_3d: {
        canvas: document.getElementById('view_3d') as HTMLCanvasElement,
    }    
};

let storedWorld = localStorage.getItem('world');
let world: World = storedWorld ? JSON.parse(storedWorld) :
{
    camera: makeCamera({location: [50,50], target: [70,70]}),
    geometry: createGeometry([
         [[30,20],[60,20],[60,80],[100,80],[100,60],[120,60],[125,75],[140,80],[140,60],[160,60],[160,80],[180,80],[180,40],[160,40],[160,0],[260,0],[260,40],[200,40],[200,140],[240,140],[240,380],[120,380],[120,140],[180,140],[180,100],[20,100]]
    ]),
    selection: []
};

const initGrid = () => {
    ui.view_2d.background.width = ui.view_2d.canvas.width;
    ui.view_2d.background.height = ui.view_2d.canvas.height;
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

let backgroundContext = ui.view_2d.background.getContext('2d');
let context = ui.view_2d.canvas.getContext('2d');
let activeActions = {} as ActiveActions;
let actionHandler = new ActionHandler(activeActions, world);
new KeyBoardListener(activeActions).start();
new GeometrySelector(ui.view_2d.canvas, world).start();
let renderer3d = new Renderer3d(world, ui.view_3d.canvas, context);
initGrid();

const redraw = () => {
    context.clearRect(0, 0, ui.view_2d.canvas.width, ui.view_2d.canvas.height);        
    drawGrid();
    drawCamera(context, world.camera);      
    drawGeometry(context, world.geometry);
    context.fillStyle = "rgb(255,255,255)";
    context.fillText('fps = ' + fps, ui.view_2d.canvas.height - 20, 10);    

    renderer3d.render();
}
const drawCamera = (context: CanvasRenderingContext2D, cam: ICamera) => {
    drawSegment(context, cam.screen, 'rgb(255,255,255)');
    makeRays(3, cam).forEach(r => {        
        drawSegment(context, r.line, 'grey');
    });
};
const drawGeometry = (context: CanvasRenderingContext2D, geometry: IGeometry) => {
    geometry.polygons.forEach(p => {
        p.vertices.forEach(e => drawVertex(context, e));
        p.edges.forEach(e => drawSegment(context, [e.start.vector, e.end.vector], 'rgb(255,255,255)'));    
    });    
};

const drawSegment = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'white') => {
    context.beginPath();
    context.moveTo(getX(segment[0]), getY(segment[0]));
    context.lineTo(getX(segment[1]), getY(segment[1]));
    context.lineWidth = 1;
    context.setLineDash([]);
    context.strokeStyle = color;
    context.stroke();
};
const drawVertex = (context: CanvasRenderingContext2D, vertex: IVertex) => {
    context.beginPath();
    context.arc(getX(vertex.vector), getY(vertex.vector), 2, 0, 2*Math.PI, false);
    context.fillStyle = world.selection.includes(vertex)? 'rgb(250,100,0)' : 'rgb(100,100,0)';
    context.fill();
}
const drawGrid = () => {        
    context.drawImage(ui.view_2d.background, 0, 0);
};
drawGrid();

function update(x: number) {
    actionHandler.handle();
}

const times: number[] = [];
let fps: number;
function loop() {
    const now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) {
      times.shift();
    }
    times.push(now);
    fps = times.length;
  
     update(now);
     redraw();
  
     window.requestAnimationFrame(loop)    
}

window.requestAnimationFrame(loop)


