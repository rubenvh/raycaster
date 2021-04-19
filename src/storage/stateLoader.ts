import { DEFAULT_CAMERA } from './../camera';
import { useAppDispatch } from './../store/index';
import { connect } from './../store/store-connector';
import { saveFile } from './dialogs';
import { EMPTY_GEOMETRY, storeGeometry } from './../geometry/geometry';
import { ipcRenderer, remote } from "electron";
import { globalState, World } from "../stateModel";
import * as fs from "fs";
import { makeCamera } from "../camera";
import { initializeCamera } from '../store/player';
import { loadWalls } from '../store/walls';

const dispatch = useAppDispatch();
export class WorldLoader {
    private world: World = globalState.world;

    private loadedFile: string;
    private camera = DEFAULT_CAMERA;
    private wallGeometry = EMPTY_GEOMETRY;

    constructor() {
        ipcRenderer.on('openFile', (_, arg) => this.loadFile(arg.filePaths[0]));
        ipcRenderer.on('saveFileAs', (_, arg) => this.saveFile(arg.filePath));
        ipcRenderer.on('saveFile', (_, arg) => this.save());
        ipcRenderer.on('newFile', (_, arg) => this.clear());
        
        const loadedFile = localStorage.getItem('loadedFile');
        if (loadedFile) {
            this.loadFile(loadedFile);
        } else {            
            this.clear();
        }

        connect(state => {
            this.camera = state.player.camera;
            this.wallGeometry = state.walls.geometry;
        })
    }

    private clear = () => {
        localStorage.removeItem('loadedFile');
        this.loadedFile = null;        
        this.loadWorld(WorldLoader.initWorld());
    };

    private save = () => {
        if (this.loadedFile){
            this.saveFile(this.loadedFile);
        } else {
            saveFile(remote.dialog, remote.getCurrentWindow());
        }
    };

    private loadFile = (path: string) => {    
        fs.readFile(path, (err, data) => {
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
            config: this.world.config });
        fs.writeFile(path, data, {}, () => {
            localStorage.setItem('loadedFile', path);
            this.loadedFile = path;           
        });  
    }

    private loadWorld = (w: any) => {
        if (w.camera) {
            dispatch(initializeCamera(makeCamera(w.camera)));
        }        

        dispatch(loadWalls(w.geometry || EMPTY_GEOMETRY));
        this.world.config = w.config || {fadeOn: null};        
    }

    public static initWorld = (): World => {
        return {                        
            config: {fadeOn: null}
        };
    }
}