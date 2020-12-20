import { saveFile } from './dialogs';
import { createGeometry, loadGeometry } from './../geometry/geometry';
import { ipcRenderer, remote } from "electron";
import { World } from "../stateModel";
import * as fs from "fs";
import { makeCamera } from "../camera";

export class WorldLoader {
    public world: World;

    private loadedFile: string;
    constructor() {
        ipcRenderer.on('openFile', (_, arg) => this.loadFile(arg.filePaths[0]));
        ipcRenderer.on('saveFileAs', (_, arg) => this.saveFile(arg.filePath));
        ipcRenderer.on('saveFile', (_, arg) => this.save());
        ipcRenderer.on('newFile', (_, arg) => this.clear());
        this.world = this.initWorld();

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
        this.loadWorld(this.initWorld());
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
            geometry: this.world.geometry });
        fs.writeFile(path, data, {}, () => {
            localStorage.setItem('loadedFile', path);
            this.loadedFile = path;           
        });  
    }

    private loadWorld = (w: any) => {
        if (w.camera) this.world.camera = w.camera;
        if (w.geometry) this.world.geometry = loadGeometry(w.geometry);
        this.world.rays.length = this.world.selection.length = 0;
    }

    private initWorld = (): World => {
        return {
            camera: makeCamera({position: [50,50], direction: [0,10], plane: [15, 0]}),
            geometry: createGeometry([]),
            selection: [],
            rays: []
        };
    }
}