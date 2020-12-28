import { IPolygon } from './../geometry/polygon';
import { isVertex } from './../geometry/selectable';
import { ipcRenderer } from 'electron';
import { World } from '../stateModel';
import { IActionHandler } from './actions';
import undoService from './undoService';
import { IVertex } from '../geometry/vertex';
import { splitPolygon } from '../geometry/geometry';

export class PolygonSplitter implements IActionHandler {

    constructor(private world: World) {}
    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_polygon_split', this.initiateSplit);
        return this;
    }    

    handle(): void {}
    isActive = (): boolean => this.world.selection.length === 2 && this.world.selection.every(isVertex);

    private get selectedVertices(): [IPolygon, [IVertex, IVertex]] {
        const selectedVertices = this.world.selection.filter(isVertex);
        const vs = selectedVertices.map(_ => _.vertex);
        if (vs.length !== 2) return null;
        return [selectedVertices[0].polygon, [vs[0], vs[1]]];
    }

    initiateSplit = () => {
        if (!this.isActive()) { return; }

        const [p, [a, b]] = this.selectedVertices;
        this.world.geometry = splitPolygon(a, b, p.id, this.world.geometry);
        undoService.push(this.world.geometry);        
    }   

}