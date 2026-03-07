/// <reference path="../renderer/electron.d.ts" />

// Player renderer entry point.
// A stripped-down version of the editor renderer that only shows the 3D view.
// All rendering, camera, store, and BSP code is shared with the editor.
//
// IMPORTANT: We import CameraActionsHandler and GlobalActionsHandler directly
// instead of using createGlobalActionHandlers() from actionHandlerFactory.ts.
// Importing actionHandlerFactory pulls in ALL editor handler modules (EdgeSplitter,
// PolygonExpander, etc.) via their top-level imports, which we don't need.

import { IActionHandler } from '../common/actions/actions';
import { CameraActionsHandler } from '../common/actions/cameraActionsHandler';
import { GlobalActionsHandler } from '../common/actions/globalActionHandler';
import { Renderer3d } from '../common/rendering/raycasting/renderer3d';
import { ZBufferRenderer } from '../common/rendering/zbuffering/zbuffer-renderer';
import { PlayerLoader } from '../common/storage/playerLoader';
import { BspGenerationService } from '../common/geometry/bsp/bsp-generation-service';

window.addEventListener('load', () => {
    const canvas = document.getElementById('view_3d') as HTMLCanvasElement;

    // Initialize shared services
    const playerLoader = new PlayerLoader();
    const renderers = [new Renderer3d(canvas), new ZBufferRenderer(canvas)];

    // Register camera movement and global toggle handlers directly
    const handlers: IActionHandler[] = [
        new CameraActionsHandler(),
        new GlobalActionsHandler(),
    ].map(h => h.register(window));

    const bspService = new BspGenerationService();

    // ESC quits the application
    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            window.close();
        }
    });

    // FPS tracking
    const times: number[] = [];
    let fps: number;
    let animationFrameId: number;
    let lastFrameTime: number = performance.now();

    function loop() {
        const now = performance.now();
        const deltaTime = (now - lastFrameTime) / 1000;
        lastFrameTime = now;

        while (times.length > 0 && times[0] <= now - 1000) { times.shift(); }
        times.push(now);
        fps = times.length;

        // Render the active 3D renderer
        renderers.forEach(r => {
            if (r.isActive()) {
                r.render(fps);
            }
        });

        // Process input handlers (camera movement, global toggles)
        handlers.forEach(h => h.handle(deltaTime));

        animationFrameId = window.requestAnimationFrame(loop);
    }
    animationFrameId = window.requestAnimationFrame(loop);

    // Cleanup on window close
    window.addEventListener('beforeunload', () => {
        if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
        }
        handlers.forEach(h => h.dispose());
        playerLoader.dispose();
        bspService.dispose();
    });
});
