import { ITextureSource } from './../textures/model';
import { IWorldConfigState } from './../store/world-config';
import { DEFAULT_CAMERA } from './../camera';
import { useAppDispatch } from './../store/index';
import { connect } from './../store/store-connector';
import { EMPTY_GEOMETRY, storeGeometry } from './../geometry/geometry';
import { makeCamera } from "../camera";
import * as cameraActions from '../store/player';
import * as wallActions  from '../store/walls';
import * as worldActions  from '../store/world-config';
import * as selectionActions  from '../store/selection';
import * as textureActions from '../store/textures';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class WorldLoader {
    private loadedFile: string | null = null;
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private worldConfig: IWorldConfigState = {};
    private textureSources: ITextureSource[] = [];
    private unsubscribe: () => void;

    // Store handler references for cleanup
    private openFileHandler = (arg: { filePaths: string[] }) => this.loadFile(arg.filePaths[0]);
    private saveFileAsHandler = (arg: { filePath: string }) => this.saveFile(arg.filePath);
    private saveFileHandler = () => this.save();
    private newFileHandler = () => this.clear();
    private importTextureHandler = (arg: { filePaths: string[] }) => this.importTexture(arg.filePaths[0]);

    constructor() {
        window.electronAPI.on('openFile', this.openFileHandler);
        window.electronAPI.on('saveFileAs', this.saveFileAsHandler);
        window.electronAPI.on('saveFile', this.saveFileHandler);
        window.electronAPI.on('newFile', this.newFileHandler);
        window.electronAPI.on('importTexture', this.importTextureHandler);

        const loadedFile = localStorage.getItem('loadedFile');
        if (loadedFile) {
            this.loadFile(loadedFile);
        } else {            
            this.clear();
        }

        this.unsubscribe = connect(state => {
            this.camera = state.player.camera;
            this.wallGeometry = state.walls.geometry;
            this.worldConfig = state.worldConfig;
            this.textureSources = state.textures.sources;            
        });
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('openFile', this.openFileHandler);
        window.electronAPI.off('saveFileAs', this.saveFileAsHandler);
        window.electronAPI.off('saveFile', this.saveFileHandler);
        window.electronAPI.off('newFile', this.newFileHandler);
        window.electronAPI.off('importTexture', this.importTextureHandler);
    }

    private importTexture = async (path: string): Promise<void> => {
        try {
            // Get image buffer and dimensions in parallel
            const [imageBuffer, dimensions] = await Promise.all([
                window.electronAPI.readFileAsBuffer(path),
                window.electronAPI.getImageSize(path)
            ]);
            const fileName = path.split('\\').pop()?.split('/').pop() || 'unknown';
            dispatch(textureActions.loadTexture({
                buffer: imageBuffer, 
                fileName,
                width: dimensions.width,
                height: dimensions.height
            }));
        } catch (error) {
            console.error('Failed to import texture:', error);
            this.showError('Import Texture Failed', `Could not import texture from: ${path}`);
        }
    };

    private clear = (): void => {
        localStorage.removeItem('loadedFile');
        this.loadedFile = null;        
        this.loadWorld({});
    };

    private save = (): void => {
        if (this.loadedFile){
            this.saveFile(this.loadedFile);
        } else {            
            window.electronAPI.send('saveNew');
        }
    };

    private loadFile = async (filePath: string): Promise<void> => {
        try {
            const data = await window.electronAPI.readFile(filePath);
            // Buffer from IPC becomes Uint8Array in renderer, need to decode it
            const content = new TextDecoder().decode(data);
            this.loadWorld(JSON.parse(content));
            localStorage.setItem('loadedFile', filePath);
            this.loadedFile = filePath;
        } catch (error) {
            console.error('Failed to load file:', error);
            this.showError('Load File Failed', `Could not load world from: ${filePath}\n\nPlease check that the file exists and is valid.`);
            // Clear the stored file path if it failed to load
            localStorage.removeItem('loadedFile');
            this.loadedFile = null;
        }
    };

    private saveFile = async (path: string): Promise<void> => {
        try {
            const data = JSON.stringify({
                camera: this.camera, 
                geometry: storeGeometry(this.wallGeometry),
                config: this.worldConfig,
                textureSources: this.textureSources 
            });
            await window.electronAPI.writeFile(path, data);
            localStorage.setItem('loadedFile', path);
            this.loadedFile = path;
        } catch (error) {
            console.error('Failed to save file:', error);
            this.showError('Save File Failed', `Could not save world to: ${path}\n\nPlease check that you have write permissions.`);
        }
    }

    private loadWorld = (w: any): void => {
        dispatch(selectionActions.clearSelection());
        dispatch(textureActions.initialize(w.textureSources || [] ));
        dispatch(cameraActions.initializeCamera(w.camera ? makeCamera(w.camera): DEFAULT_CAMERA));
        dispatch(wallActions.loadWalls(w.geometry || EMPTY_GEOMETRY));
        dispatch(worldActions.initialize(w.config || {fadeOn: null}));         
    }

    private showError = (title: string, message: string): void => {
        // Display error to user via alert (simple solution)
        // In a production app, you might want to send this to main process
        // to show a native dialog instead
        alert(`${title}\n\n${message}`);
    }
}
