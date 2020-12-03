
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { loadWorld, World } from "./world";
import { createGeometry } from "./geometry/geometry";
import { makeCamera } from "./camera";
import { createCanvasHandlers, createGlobalActionHandlers } from './actions/actionHandlerFactory';
import { Renderer3d } from './renderer3d';
import { Renderer2d } from "./renderer2d";

const ui = {    
    rotateButton: document.getElementById('rotate'),
    view_2d: {
        canvas: document.getElementById('view_2d') as HTMLCanvasElement
    },
    view_3d: {
        canvas: document.getElementById('view_3d') as HTMLCanvasElement,
    }    
};

let storedWorld = localStorage.getItem('world');
let world: World = storedWorld ? loadWorld(JSON.parse(storedWorld)) :
{
    camera: makeCamera({position: [50,50], direction: [0,-10], plane: [-15, 0]}),
    geometry: createGeometry([
         [[30,20],[60,20],[60,80],[100,80],[100,60],[120,60],[125,75],[140,80],[140,60],[160,60],[160,80],[180,80],[180,40],[160,40],[160,0],[260,0],[260,40],[200,40],[200,140],[240,140],[240,380],[120,380],[120,140],[180,140],[180,100],[20,100]]
    ]),
    selection: [],
    rays: []
};

let handlers = [...createGlobalActionHandlers(world), ...createCanvasHandlers(ui.view_2d.canvas, world)];
let renderer3d = new Renderer3d(world, ui.view_3d.canvas);
let renderer2d = new Renderer2d(world, ui.view_2d.canvas);

const times: number[] = [];
let fps: number;
function loop() {
    const now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) {
      times.shift();
    }
    times.push(now);
    fps = times.length;
  
     
     redraw();
     update();
     
     window.requestAnimationFrame(loop)    
}
window.requestAnimationFrame(loop)

function redraw() {      
    renderer2d.render(fps);
    renderer3d.render();
}

function update() {    
    handlers.forEach(_=>_.handle());
}



