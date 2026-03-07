import { loadWorld, loadMapFile } from './load-world';

/// <reference path="../../renderer/electron.d.ts" />

/**
 * PlayerLoader handles map loading for the player executable.
 * 
 * Unlike the editor's WorldLoader, it does not register IPC listeners for
 * save/open/new/import operations. It receives the map path from the main 
 * process via IPC and loads it into the shared Redux store.
 * 
 * The public loadMap() method can also be called at runtime (e.g., by a future
 * animation system) to switch maps during gameplay.
 */
export class PlayerLoader {

    constructor() {
        // Listen for the map file path from the main process
        window.electronAPI.on('loadMapFile', this.onLoadMapFile);
    }

    /**
     * Load a map from a file path into the Redux store.
     * Can be called at startup (via IPC from main process) or at runtime
     * (e.g., by an animation system triggering a level transition).
     */
    async loadMap(filePath: string): Promise<void> {
        try {
            await loadMapFile(filePath);
        } catch (error) {
            console.error('Failed to load map:', error);
            // In the player, load an empty world as fallback
            loadWorld({});
        }
    }

    dispose(): void {
        window.electronAPI.off('loadMapFile', this.onLoadMapFile);
    }

    private onLoadMapFile = (arg: { filePath: string }): void => {
        this.loadMap(arg.filePath);
    };
}
