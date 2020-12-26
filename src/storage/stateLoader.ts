import { saveFile } from './dialogs';
import { createGeometry, loadGeometry } from './../geometry/geometry';
import { ipcRenderer, remote } from "electron";
import { globalState, World } from "../stateModel";
import * as fs from "fs";
import { makeCamera } from "../camera";
import undoService from '../actions/undoService';

export class WorldLoader {
    private world: World = globalState.world;

    private loadedFile: string;
    constructor() {
        ipcRenderer.on('openFile', (_, arg) => this.loadFile(arg.filePaths[0]));
        ipcRenderer.on('saveFileAs', (_, arg) => this.saveFile(arg.filePath));
        ipcRenderer.on('saveFile', (_, arg) => this.save());
        ipcRenderer.on('newFile', (_, arg) => this.clear());
        this.loadWorld(WorldLoader.initWorld());

        const loadedFile = localStorage.getItem('loadedFile');
        if (loadedFile) {
            this.loadFile(loadedFile);
        } else {
            this.clear();
        }
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
            camera: this.world.camera, 
            geometry: this.world.geometry,
            config: this.world.config });
        fs.writeFile(path, data, {}, () => {
            localStorage.setItem('loadedFile', path);
            this.loadedFile = path;           
        });  
    }

    private loadWorld = (w: any) => {
        this.world.camera = w.camera || WorldLoader.initWorld().camera;
        this.world.geometry = loadGeometry(w.geometry || []);
        this.world.config = w.config || {fadeOn: null};
        this.world.rays.length = this.world.selection.length = 0;

        undoService.initialize(this.world.geometry);
    }

    public static initWorld = (): World => {
        return {
            camera: makeCamera({position: [50,50], direction: [0,10], plane: [15, 0]}),
            geometry: createGeometry([]),
            config: {fadeOn: null},
            selection: [],
            rays: []
        };
    }
}