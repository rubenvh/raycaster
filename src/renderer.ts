// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { Vertex } from "./vertex";
import { Camera } from "./camera";
import { Segment } from "./segment";

const ui = {
    redrawButton: document.getElementById('redraw'),
    canvas: document.getElementById('view_2d') as HTMLCanvasElement
};

let camera = new Camera(new Vertex(50,50), new Vertex(150, 200));
let context = ui.canvas.getContext('2d');

ui.redrawButton.addEventListener('click', () => {
    console.log('redrawing');
    context.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
    drawCamera(context, camera);    
});

const drawCamera = (context: CanvasRenderingContext2D, cam: Camera) => {
        
    drawSegment(context, camera.screen);
    camera.makeRays(15).forEach(s => {        
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

