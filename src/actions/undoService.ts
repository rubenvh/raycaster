import { ipcRenderer } from 'electron';
import { useAppDispatch } from '../store';
import { connect } from '../store/store-connector';
import { updateWalls } from '../store/walls';
import { EMPTY_GEOMETRY, IGeometry } from './../geometry/geometry';

const dispatch = useAppDispatch();

export class UndoService {    
    private timeline: IGeometry[] = []
    private index: number = 0;
    private wallGeometry = EMPTY_GEOMETRY;
    
    constructor() {        
        ipcRenderer.on('undo', this.undo);
        ipcRenderer.on('redo', this.redo);

        connect(state => {
            if (!this.timeline.includes(state.walls.geometry)) {
                this.wallGeometry = state.walls.geometry;
                this.push(this.wallGeometry);
            }            
        });
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

        dispatch(updateWalls(this.timeline[this.index]));        
    }
    private redo = () => {
        const redone = (this.timeline[this.index+1] != undefined)
            ? this.timeline[++this.index]
            : this.timeline[this.index];

        dispatch(updateWalls(redone));
    }
}

export default new UndoService();