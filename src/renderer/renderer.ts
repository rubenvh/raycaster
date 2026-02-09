// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import { createCanvasHandlers, createGlobalActionHandlers, IDisposableHandlers } from '../common/actions/actionHandlerFactory';
import { Renderer3d } from '../common/rendering/raycasting/renderer3d';
import { ZBufferRenderer } from '../common/rendering/zbuffering/zbuffer-renderer';
import { MapEditorRenderer } from '../common/editor/mapEditor';
import { WorldLoader } from '../common/storage/stateLoader';
import { UndoService } from '../common/actions/undoService';
import { connect } from '../common/store/store-connector';
import { BspGenerationStarter } from '../common/geometry/bsp/bspGenerationStarter';
import { loadComponents } from './components';
import GeometrySelectionComponent from './components/geometrySelectionComponent';
import GeometryEditorComponent from './components/geometryEditorComponent';
import StatsElement from './components/statsComponent';
import { TestCanvasRenderer } from './testCanvas';
import TextureLibraryElement from './components/textureLibraryComponent';

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
        textureLibrary: document.getElementById('texture-library') as TextureLibraryElement,
    };

    // Track all disposable resources for cleanup
    const worldLoader = new WorldLoader();
    const undoService = new UndoService();
    let renderers = [new Renderer3d(ui.view_3d.canvas), new ZBufferRenderer(ui.view_3d.canvas)];
    let mapEditor = new MapEditorRenderer(ui.view_2d.canvas);
    const globalHandlers = createGlobalActionHandlers();
    const canvasHandlers = createCanvasHandlers(ui.view_2d.canvas, mapEditor);
    const handlers = [...globalHandlers.handlers, ...canvasHandlers.handlers];

    let testCanvas = new TestCanvasRenderer(ui.view_2d.canvas);//, mapEditor.context);
    const bspStarter = new BspGenerationStarter();

    const unsubscribeStats = connect(s => {
        ui.stats.data = s.stats;
    });

    const times: number[] = [];
    let fps: number;
    let animationFrameId: number;
    
    function loop() {
        const now = performance.now();
        while (times.length > 0 && times[0] <= now - 1000) { times.shift(); }
        times.push(now);
        fps = times.length;
        redraw();
        update();
        animationFrameId = window.requestAnimationFrame(loop);
    }
    animationFrameId = window.requestAnimationFrame(loop);

    function redraw() {
        testCanvas.render(fps);
        mapEditor.render(fps);
        renderers.forEach(r => {
            if (r.isActive()) {
                r.render(fps);
            }
        });
    }

    function update() {
        handlers.forEach(_ => _.handle());
    }

    // Cleanup function for when the window is unloaded
    window.addEventListener('beforeunload', () => {
        // Cancel animation frame
        if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
        }
        
        // Dispose all handlers
        globalHandlers.dispose();
        canvasHandlers.dispose();
        
        // Dispose services
        worldLoader.dispose();
        undoService.dispose();
        bspStarter.dispose();
        
        // Unsubscribe store connection
        unsubscribeStats();
    });
});

