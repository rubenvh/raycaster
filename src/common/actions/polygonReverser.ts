import { isPolygon, SelectableElement } from '../selection/selectable';
import { IPolygon } from "../geometry/polygon";
import { IActionHandler } from "./actions";
import { connect } from '../store/store-connector';
import * as actions from '../store/walls';
import { useAppDispatch } from '../store';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();
export class PolygonReverser implements IActionHandler {
   
    private selectedElements: SelectableElement[] = [];
    
    constructor() { 
        connect(s => {
            this.selectedElements = s.selection.elements;    
        });
    }

    private get selectedPolygons(): IPolygon[] {
        return this.selectedElements.filter(isPolygon).map(_ => _.polygon);
    }

    register(g: GlobalEventHandlers): IActionHandler {
        window.electronAPI.on('geometry_polygon_reverse', this.reverse);
        return this;
    }

    handle(): void {
    }
    public isActive = () => true;


    private reverse = (): boolean => {
        dispatch(actions.reversePolygon(this.selectedPolygons.map(x => x.id)));
        return true;
    };
}
