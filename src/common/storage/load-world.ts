import { DEFAULT_CAMERA, makeCamera } from '../camera';
import { useAppDispatch } from '../store/index';
import { EMPTY_GEOMETRY } from '../geometry/geometry';
import * as cameraActions from '../store/player';
import * as wallActions from '../store/walls';
import * as worldActions from '../store/world-config';
import { DEFAULT_SUN_ANGLE } from '../store/world-config';
import * as selectionActions from '../store/selection';
import * as textureActions from '../store/textures';
import { setBsp } from '../store/bsp-state';
import { recomputeBspBounds } from '../geometry/bsp/model';
import { getEmbeddedTextureSources } from '../textures/embedded-textures';

const dispatch = useAppDispatch();

/**
 * Load a parsed world object into the Redux store.
 * This is the shared deserialization logic used by both the editor (WorldLoader)
 * and the player (PlayerLoader). Any changes to world loading must be made here
 * so they apply to both executables automatically.
 * 
 * @param w - A parsed JSON world object (may be empty `{}` for a blank world)
 */
export function loadWorld(w: any): void {
    dispatch(selectionActions.clearSelection());
    // Use saved texture sources, or fall back to embedded textures if none exist
    const textureSources = (w.textureSources && w.textureSources.length > 0)
        ? w.textureSources
        : getEmbeddedTextureSources();
    dispatch(textureActions.initialize(textureSources));
    dispatch(cameraActions.initializeCamera(w.camera ? makeCamera(w.camera) : DEFAULT_CAMERA));
    dispatch(wallActions.loadWalls(w.geometry || EMPTY_GEOMETRY));
    const config = w.config || { fadeOn: null };
    if (config.skybox && config.skyboxEnabled == null) {
        config.skyboxEnabled = true;
    }
    if (config.sunAngle == null) {
        config.sunAngle = DEFAULT_SUN_ANGLE;
    }
    // Backward compatibility: convert old floorColor [r,g,b] to floorMaterial {color: [r,g,b,1]}
    if (config.floorColor && !config.floorMaterial) {
        const [r, g, b] = config.floorColor;
        config.floorMaterial = { color: [r, g, b, 1] };
    }
    dispatch(worldActions.initialize(config));
    // Restore BSP: prefer top-level bsp field, fall back to legacy geometry.bsp
    const savedBsp = w.bsp || (w.geometry && w.geometry.bsp) || null;
    const bsp = savedBsp ? recomputeBspBounds(savedBsp) : null;
    dispatch(setBsp(bsp));
}

/**
 * Load a map file from disk into the Redux store.
 * Reads the file via electronAPI, parses the JSON, and calls loadWorld().
 * 
 * This function can be called from any context that has access to window.electronAPI:
 * - WorldLoader (editor) at startup or on file open
 * - PlayerLoader (player) at startup
 * - Future animation system for runtime map switching
 * 
 * @param filePath - Absolute path to a .json map file
 */
export async function loadMapFile(filePath: string): Promise<void> {
    const data = await window.electronAPI.readFile(filePath);
    const content = new TextDecoder().decode(data);
    loadWorld(JSON.parse(content));
}
