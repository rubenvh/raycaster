import { ITextureSource } from './../textures/model';
import { IWorldConfigState } from './../store/world-config';
import { DEFAULT_CAMERA } from './../camera';
import { useAppDispatch } from './../store/index';
import { connect } from './../store/store-connector';
//import { saveFile } from './dialogs';
import { EMPTY_GEOMETRY, storeGeometry } from './../geometry/geometry';
import { ipcRenderer } from "electron";
import * as fs from "fs";
import { makeCamera } from "../camera";
import * as cameraActions from '../store/player';
import * as wallActions  from '../store/walls';
import * as worldActions  from '../store/world-config';
import * as selectionActions  from '../store/selection';
import * as textureActions from '../store/textures';

const dispatch = useAppDispatch();
export class WorldLoader {
    private loadedFile: string;
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;
    private worldConfig: IWorldConfigState = {};
    private textureSources: ITextureSource[] = [];

    constructor() {
        ipcRenderer.on('openFile', (_, arg) => this.loadFile(arg.filePaths[0]));
        ipcRenderer.on('saveFileAs', (_, arg) => this.saveFile(arg.filePath));
        ipcRenderer.on('saveFile', (_, __) => this.save());
        ipcRenderer.on('newFile', (_, __) => this.clear());
        ipcRenderer.on('importTexture', (_, arg) => this.importTexture(arg.filePaths[0]));

        const loadedFile = localStorage.getItem('loadedFile');
        if (loadedFile) {
            this.loadFile(loadedFile);
        } else {            
            this.clear();
        }

        connect(state => {
            this.camera = state.player.camera;
            this.wallGeometry = state.walls.geometry;
            this.worldConfig = state.worldConfig;
            this.textureSources = state.textures.sources;
        })
    }

    private importTexture = (path: string) => {    
        fs.readFile(path, (_, imageBuffer) => {    
            const fileName = path.split('\\').pop().split('/').pop();                    
            dispatch(textureActions.loadTexture({buffer: imageBuffer, path, fileName}));            
        });  
    };

    private clear = () => {
        localStorage.removeItem('loadedFile');
        this.loadedFile = null;        
        this.loadWorld({});
    };

    private save = () => {
        if (this.loadedFile){
            this.saveFile(this.loadedFile);
        } else {            
            ipcRenderer.send('saveNew');
        }
    };

    private loadFile = (path: string) => {    
        fs.readFile(path, (_, data) => {
            // TODO: error handling
            this.loadWorld(JSON.parse(data.toString()));
            localStorage.setItem('loadedFile', path);
            this.loadedFile = path;
        });  
    };

    private saveFile = (path: string) => {    
        const data = JSON.stringify({
            camera: this.camera, 
            geometry: storeGeometry(this.wallGeometry),
            config: this.worldConfig,
            textureSources: this.textureSources });
        fs.writeFile(path, data, {}, () => {
            localStorage.setItem('loadedFile', path);
            this.loadedFile = path;           
        });  
    }

    private loadWorld = (w: any) => {
        dispatch(selectionActions.clearSelection());
        dispatch(textureActions.initialize(w.textureSources || [] ));
        dispatch(cameraActions.initializeCamera(w.camera ? makeCamera(w.camera): DEFAULT_CAMERA));
        dispatch(wallActions.loadWalls(w.geometry || EMPTY_GEOMETRY));
        dispatch(worldActions.initialize(w.config || {fadeOn: null}));         
    }   
}