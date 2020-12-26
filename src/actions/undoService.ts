import { ipcRenderer } from 'electron';
import { globalState, World } from '../stateModel';
import { IGeometry } from './../geometry/geometry';
export class UndoService {
    private world: World = globalState.world;
    private timeline: IGeometry[] = []
    private index: number = 0;
    constructor() {        
        ipcRenderer.on('undo', this.undo);
        ipcRenderer.on('redo', this.redo);
    }

    initialize = (g: IGeometry): IGeometry => {
        this.timeline = [g];
        this.index = 0;
        return g;
    }

    push = (g: IGeometry): IGeometry => {
        this.timeline = this.timeline.slice(0, ++this.index).concat(g);
        return g;
    }

    private undo = () => {
        this.index = Math.max(0, this.index - 1);
        this.world.geometry = this.timeline[this.index];
    }
    private redo = () => {
        this.world.geometry = (this.timeline[this.index+1] != undefined)
            ? this.timeline[++this.index]
            : this.timeline[this.index];
    }
}

export default new UndoService();