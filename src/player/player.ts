/// <reference path="../renderer/electron.d.ts" />

// Player renderer entry point.
// A stripped-down version of the editor renderer that only shows the 3D view.
// All rendering, camera, store, and BSP code is shared with the editor.
//
// IMPORTANT: We import CameraActionsHandler and GlobalActionsHandler directly
// instead of using createGlobalActionHandlers() from actionHandlerFactory.ts.
// Importing actionHandlerFactory pulls in ALL editor handler modules (EdgeSplitter,
// PolygonExpander, etc.) via their top-level imports, which we don't need.
//
// Dance mode: When the main process sends 'danceMode', we replace the
// CameraActionsHandler with DanceActionHandler for audio-driven camera movement.
//
// IPC timing: The 'danceMode' IPC message arrives asynchronously after
// did-finish-load, which can race with the synchronous 'load' event handler.
// We use a Promise to defer handler creation until we know whether dance mode
// is enabled. A timeout ensures we don't block forever if the IPC never arrives
// (normal non-dance player launch doesn't send the message at all).

import { IActionHandler } from '../common/actions/actions';
import { CameraActionsHandler } from '../common/actions/cameraActionsHandler';
import { DanceActionHandler } from '../common/actions/dance-action-handler';
import { GlobalActionsHandler } from '../common/actions/globalActionHandler';
import { Renderer3d } from '../common/rendering/raycasting/renderer3d';
import { ZBufferRenderer } from '../common/rendering/zbuffering/zbuffer-renderer';
import { MiniMap } from '../common/rendering/minimap';
import { PlayerLoader } from '../common/storage/playerLoader';
import { BspGenerationService } from '../common/geometry/bsp/bsp-generation-service';
import { setResolution } from '../common/config/resolution';

// Apply resolution from URL query parameter (set by main process from --resolution CLI arg)
const _resParam = new URLSearchParams(window.location.search).get('resolution');
if (_resParam) {
    const val = parseInt(_resParam, 10);
    if (!isNaN(val) && val > 0) setResolution(val);
}

// Promise that resolves to true if dance mode is enabled, false otherwise.
// Resolves when the 'danceMode' IPC arrives, or after a short timeout
// (for normal player launches that never send the message).
const danceModePromise = new Promise<boolean>((resolve) => {
    let resolved = false;

    window.electronAPI.on('danceMode', (args: { enabled: boolean }) => {
        if (!resolved) {
            resolved = true;
            console.log('[Player] Dance mode:', args.enabled ? 'enabled' : 'disabled');
            resolve(args.enabled);
        }
    });

    // Timeout: if no IPC arrives within 2 seconds of module load, assume no dance mode.
    // This handles normal `npm run play` launches that don't send the message.
    setTimeout(() => {
        if (!resolved) {
            resolved = true;
            console.log('[Player] No dance mode IPC received, using normal camera controls');
            resolve(false);
        }
    }, 2000);
});

window.addEventListener('load', () => {
    const canvas = document.getElementById('view_3d') as HTMLCanvasElement;

    // Initialize shared services
    const playerLoader = new PlayerLoader();
    const renderers = [new Renderer3d(canvas), new ZBufferRenderer(canvas)];

    // Global actions handler is always needed (renderer toggles, etc.)
    const globalHandler = new GlobalActionsHandler().register(window);

    // Active handlers list — starts with just global, camera handler added once IPC resolves
    const handlers: IActionHandler[] = [globalHandler];
    // Reference to dance handler if in dance mode (for path overlay)
    let danceHandler: DanceActionHandler | null = null;

    const bspService = new BspGenerationService();

    // Minimap overlay (TAB to toggle, off by default)
    const minimap = new MiniMap();
    const canvasContext = canvas.getContext('2d');

    // ESC quits the application, TAB toggles minimap
    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            window.close();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            minimap.toggle();
        }
    });

    // Wait for dance mode IPC to resolve, then create the appropriate camera handler.
    danceModePromise.then((isDanceMode) => {
        let cameraHandler: IActionHandler;
        if (isDanceMode) {
            const handler = new DanceActionHandler();
            danceHandler = handler;
            cameraHandler = handler;
        } else {
            cameraHandler = new CameraActionsHandler();
        }
        cameraHandler.register(window);
        handlers.push(cameraHandler);
        console.log(`[Player] Camera handler created: ${isDanceMode ? 'DanceActionHandler' : 'CameraActionsHandler'}`);
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

        // Draw minimap overlay on top of 3D view
        // In dance mode, feed the A* path to the minimap for display
        if (danceHandler) {
            const pathInfo = danceHandler.getCurrentPath();
            minimap.setPath(pathInfo.waypoints, pathInfo.waypointIndex);
        }
        minimap.draw(canvasContext, canvas.width, canvas.height);

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
        minimap.dispose();
        playerLoader.dispose();
        bspService.dispose();
    });
});
