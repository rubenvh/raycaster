import { GeometryBuilder } from './geometryBuilder';
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { Vertex } from "./vertex";
import { Camera } from "./camera";
import { Segment } from "./segment";
import { KeyBoardListener } from "./keyboard-listener";
import { ActionHandler, ActiveActions } from "./actionHandler";
import { World } from "./world";
import { Geometry } from "./geometry";


const ui = {    
    rotateButton: document.getElementById('rotate'),
    canvas: document.getElementById('view_2d') as HTMLCanvasElement
};

let world: World = {
    camera: new Camera(new Vertex(50,50), new Vertex(70, 70)),
    geometry: new Geometry()
};
let context = ui.canvas.getContext('2d');
let activeActions = {} as ActiveActions;
let actionHandler = new ActionHandler(activeActions, world);
new KeyBoardListener(activeActions).start();
new GeometryBuilder(ui.canvas, world.geometry).start();

const redraw = () => {
    context.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    drawGrid();
    drawCamera(context, world.camera);  
}
const drawCamera = (context: CanvasRenderingContext2D, cam: Camera) => {
    drawSegment(context, cam.screen);
    cam.makeRays(15).forEach(s => {        
        drawSegment(context, s, 'grey');
    });
};

const drawSegment = (context: CanvasRenderingContext2D, segment: Segment, color: string = 'white') => {
    context.beginPath();
    context.moveTo(segment.start.x, segment.start.y);
    context.lineTo(segment.end.x, segment.end.y);
    context.lineWidth = 1;
    context.setLineDash([4, 2]);
    context.strokeStyle = color;
    context.stroke();
};

const drawGrid = () => {    
    context.beginPath();
    context.lineWidth = 1;
    context.setLineDash([4, 2]);
    context.strokeStyle = 'rgb(0,0,0)';
    for (let x = 0; x <= context.canvas.width; x += 20) {
        context.moveTo(x, 0);
        context.lineTo(x, context.canvas.height);
        for (let y = 0; y <= context.canvas.height; y += 20) {
            context.moveTo(0, y);
            context.lineTo(context.canvas.width, y);
        }
    }
    context.stroke();

};

function update(x: number) {
    actionHandler.handle();
}

function loop(timestamp) {
    var progress = timestamp - lastRender
  
    update(progress)
    redraw();
  
    lastRender = timestamp
    window.requestAnimationFrame(loop)
  }
var lastRender = 0
window.requestAnimationFrame(loop)
