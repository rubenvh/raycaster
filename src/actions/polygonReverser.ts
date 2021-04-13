import { reversePolygon } from '../geometry/geometry';
import { isPolygon, SelectableElement } from '../geometry/selectable';
import { IPolygon } from "../geometry/polygon";
import { World } from "../stateModel";
import { IActionHandler } from "./actions";
import { ipcRenderer } from 'electron';
import undoService from './undoService';
import { connect } from '../store/store-connector';


export class PolygonReverser implements IActionHandler {
   
    private selectedElements: SelectableElement[] = [];
    
    constructor(private world: World) { 
        connect(s => {
            this.selectedElements = s.selection.elements;
        });
    }

    private get selectedPolygons(): IPolygon[] {
        return this.selectedElements.filter(isPolygon).map(_ => _.polygon);
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
