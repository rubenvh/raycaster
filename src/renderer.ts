// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { createCanvasHandlers, createGlobalActionHandlers } from './actions/actionHandlerFactory';
import { Renderer3d } from './renderer3d';
import { Renderer2d } from "./renderer2d";
import { textureLib } from './textures/textureLibrary';
import { WorldLoader } from './storage/stateLoader';
import { UndoService } from './actions/undoService';
import { StatsElement } from './components/statsComponent';
import { connect } from './store/store-connector';
import { GeometrySelectionComponent } from './components/geometrySelectionComponent';
import { GeometryEditorComponent } from './components/geometryEditorComponent';

const ui = {        
    view_2d: {
        canvas: document.getElementById('view_2d') as HTMLCanvasElement
    },
    view_3d: {
        canvas: document.getElementById('view_3d') as HTMLCanvasElement,
    },
    stats: document.getElementById('stats') as StatsElement,
    selectionTree: document.getElementById('geometry-selection') as GeometrySelectionComponent,
    geometryEditor: document.getElementById('geometry-editor') as GeometryEditorComponent,
};

let worldLoader = new WorldLoader();
let undoRegistrations = new UndoService();
let handlers = [...createGlobalActionHandlers(), ...createCanvasHandlers(ui.view_2d.canvas, textureLib)];
let renderer3d = new Renderer3d(ui.view_3d.canvas, textureLib);
let renderer2d = new Renderer2d(ui.view_2d.canvas);

connect(s => {
    ui.stats.data = s.stats;        
});
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
    renderer3d.render(fps);
}

function update() {    
    handlers.forEach(_=>_.handle());
}
