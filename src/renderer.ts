// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { getX, getY } from "./vector";
import { ILineSegment } from "./lineSegment";
import { KeyBoardListener } from "./keyboard-listener";
import { ActionHandler, ActiveActions } from "./actionHandler";
import { World } from "./world";
import { createGeometry } from "./geometry";
import math = require('mathjs');
import { GeometrySelector } from "./geometrySelector";
import { IGeometry, IVertex } from "./vertex";
import { ICamera, makeCamera, makeRays } from "./camera";


const ui = {    
    rotateButton: document.getElementById('rotate'),
    view_2d: {
        background: document.getElementById('view_2d_background') as HTMLCanvasElement,
        canvas: document.getElementById('view_2d') as HTMLCanvasElement
    }
    
};

let world: World = {
    camera: makeCamera({location: [50,50], target: [70,70]}),
    geometry: createGeometry([
        [...Array.from(Array(23).keys()).map(x => [20,20+20*x]),
         ...Array.from(Array(31).keys()).map(x => [20+20*x,460]),
         ...Array.from(Array(23).keys()).map(x => [620,460-20*x]),
         ...Array.from(Array(29).keys()).map(x => [600-20*x,20])
        ]
    ]),
    selection: []
};
let backgroundContext = ui.view_2d.background.getContext('2d');
let context = ui.view_2d.canvas.getContext('2d');
let activeActions = {} as ActiveActions;
let actionHandler = new ActionHandler(activeActions, world);
new KeyBoardListener(activeActions).start();
new GeometrySelector(ui.view_2d.canvas, world).start();

const redraw = () => {
    context.clearRect(0, 0, ui.view_2d.canvas.width, ui.view_2d.canvas.height);    
    drawCamera(context, world.camera);  
    drawGeometry(context, world.geometry);
}
const drawCamera = (context: CanvasRenderingContext2D, cam: ICamera) => {
    drawSegment(context, cam.screen, 'rgb(255,255,255)');
    makeRays(15, cam).forEach(s => {        
        drawSegment(context, s, 'grey');
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
drawGrid();