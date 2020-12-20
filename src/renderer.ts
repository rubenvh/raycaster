import { TextureLibrary } from './textures/textureLibrary';

// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { createCanvasHandlers, createGlobalActionHandlers } from './actions/actionHandlerFactory';
import { Renderer3d } from './renderer3d';
import { Renderer2d } from "./renderer2d";
import { WorldLoader } from "./storage/stateLoader";
import { State } from './stateModel';

const ui = {    
    rotateButton: document.getElementById('rotate'),
    view_2d: {
        canvas: document.getElementById('view_2d') as HTMLCanvasElement
    },
    view_3d: {
        canvas: document.getElementById('view_3d') as HTMLCanvasElement,
    }    
};

let worldLoader = new WorldLoader();
let textureLib = new TextureLibrary();
let state: State = {
    world: worldLoader.world,
    textures: textureLib.textures,
}
let handlers = [...createGlobalActionHandlers(state.world), ...createCanvasHandlers(ui.view_2d.canvas, state.world)];
let renderer3d = new Renderer3d(state.world, ui.view_3d.canvas, textureLib);
let renderer2d = new Renderer2d(state.world, ui.view_2d.canvas);

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
