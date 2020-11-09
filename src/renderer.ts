// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { Vertex } from "./vertex";
import { Camera } from "./camera";
import { Segment } from "./segment";
import { KeyBoardListener } from "./keyboard-listener";
import { ActionHandler, ActiveActions } from "./actionHandler";
import { World } from "./world";


const ui = {    
    rotateButton: document.getElementById('rotate'),
    canvas: document.getElementById('view_2d') as HTMLCanvasElement
};

let world: World = {camera: new Camera(new Vertex(50,50), new Vertex(70, 70))};
let context = ui.canvas.getContext('2d');
let activeActions = {} as ActiveActions;
let actionHandler = new ActionHandler(activeActions, world);
new KeyBoardListener(activeActions).start();

const redraw = () => {
    context.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
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
    context.lineTo(segment.start.x, segment.start.y);
    context.lineTo(segment.end.x, segment.end.y);
    context.lineWidth = 1;
    context.strokeStyle = color;    
    context.stroke();
    context.closePath();
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
