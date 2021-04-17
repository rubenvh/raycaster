import { EMPTY_GEOMETRY, reversePolygon } from '../geometry/geometry';
import { isPolygon, SelectableElement } from '../geometry/selectable';
import { IPolygon } from "../geometry/polygon";
import { World } from "../stateModel";
import { IActionHandler } from "./actions";
import { ipcRenderer } from 'electron';
import undoService from './undoService';
import { connect } from '../store/store-connector';


export class PolygonReverser implements IActionHandler {
   
    private selectedElements: SelectableElement[] = [];
    private wallGeometry = EMPTY_GEOMETRY;

    constructor(private world: World) { 
        connect(s => {
            this.selectedElements = s.selection.elements;
            this.wallGeometry = s.walls.geometry;
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
        this.wallGeometry = reversePolygon(this.selectedPolygons.map(x => x.id), this.wallGeometry);
        undoService.push(this.wallGeometry);
        return true;
    };
}
