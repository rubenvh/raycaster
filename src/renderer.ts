
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { World } from "./world";
import { createGeometry } from "./geometry/geometry";
import { makeCamera } from "./camera";
import { createCanvasHandlers, createGlobalActionHandlers } from './actions/actionHandlerFactory';
import { Renderer3d } from './renderer3d';
import { Renderer2d } from "./renderer2d";
import { StateLoader } from "./storage/stateLoader";

const ui = {    
    rotateButton: document.getElementById('rotate'),
    view_2d: {
        canvas: document.getElementById('view_2d') as HTMLCanvasElement
    },
    view_3d: {
        canvas: document.getElementById('view_3d') as HTMLCanvasElement,
    }    
};

let stateLoader = new StateLoader();
let world: World = stateLoader.state;

let handlers = [...createGlobalActionHandlers(world), ...createCanvasHandlers(ui.view_2d.canvas, world)];
let renderer3d = new Renderer3d(world, ui.view_3d.canvas);
let renderer2d = new Renderer2d(world, ui.view_2d.canvas);

const times: number[] = [];
let fps: number;
function loop() {
    const now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) { times.shift(); }
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
