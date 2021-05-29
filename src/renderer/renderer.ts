// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { createCanvasHandlers, createGlobalActionHandlers } from '../common/actions/actionHandlerFactory';
import { Renderer3d } from '../common/renderer3d';
import { MapEditorRenderer } from '../common/mapEditor';
import { textureLib } from '../common/textures/textureLibrary';
import { WorldLoader } from '../common/storage/stateLoader';
import { UndoService } from '../common/actions/undoService';
import { connect } from '../common/store/store-connector';
import { BspGenerationStarter } from '../common/geometry/bsp/BspGenerationStarter';
import { loadComponents } from './components';
import GeometrySelectionComponent from './components/geometrySelectionComponent';
import GeometryEditorComponent from './components/geometryEditorComponent';
import StatsElement from './components/statsComponent';
import { TestCanvasRenderer } from './testCanvas';

loadComponents();

window.addEventListener('load', (event) => {
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
    
    new WorldLoader();
    new UndoService();
    let handlers = [...createGlobalActionHandlers(), ...createCanvasHandlers(ui.view_2d.canvas, textureLib)];
    let renderer3d = new Renderer3d(ui.view_3d.canvas, textureLib);
    let mapEditor = new MapEditorRenderer(ui.view_2d.canvas);
    let testCanvas = new TestCanvasRenderer(ui.view_2d.canvas);//, mapEditor.context);
    new BspGenerationStarter();
    
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
        window.requestAnimationFrame(loop);
    }
    window.requestAnimationFrame(loop);

    function redraw() {      
        testCanvas.render(fps);
        mapEditor.render(fps);
        renderer3d.render(fps);        
    }

    function update() {    
        handlers.forEach(_=>_.handle());
    }
});

