import { reversePolygon } from '../geometry/geometry';
import { isPolygon } from '../geometry/selectable';
import { IPolygon } from "../geometry/polygon";
import { World } from "../stateModel";
import { IActionHandler } from "./actions";
import { ipcRenderer } from 'electron';
import undoService from './undoService';


export class PolygonReverser implements IActionHandler {
   
    constructor(private world: World) { }

    private get selectedPolygons(): IPolygon[] {
        return this.world.selection.filter(isPolygon).map(_ => _.polygon);
    }

    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_polygon_reverse', this.reverse);
        return this;
    }

    handle(): void {
    }
    public isActive = () => true;


    private reverse = (): boolean => {
        this.world.geometry = reversePolygon(this.selectedPolygons.map(x => x.id), this.world.geometry);
        undoService.push(this.world.geometry);
        return true;
    };
}
