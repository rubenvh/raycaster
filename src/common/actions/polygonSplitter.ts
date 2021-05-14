import { EMPTY_GEOMETRY, IGeometry } from './../geometry/geometry';
import { IPolygon } from './../geometry/polygon';
import { isVertex, SelectableElement } from '../selection/selectable';
import { ipcRenderer } from 'electron';
import { IActionHandler } from './actions';
import { IVertex } from '../geometry/vertex';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { clearSelection } from '../store/selection';

const dispatch = useAppDispatch();
export class PolygonSplitter implements IActionHandler {

    private selectedElements: SelectableElement[] = [];
       
    constructor() { 
        connect(s => {
            this.selectedElements = s.selection.elements;    
        });
    }
    register(g: GlobalEventHandlers): IActionHandler {
        ipcRenderer.on('geometry_polygon_split', this.initiateSplit);
        return this;
    }    

    handle(): void {}
    isActive = (): boolean => this.selectedElements.length === 2 && this.selectedElements.every(isVertex);

    private get selectedVertices(): [IPolygon, [IVertex, IVertex]] {
        const selectedVertices = this.selectedElements.filter(isVertex);
        const vs = selectedVertices.map(_ => _.vertex);
        if (vs.length !== 2) return null;
        return [selectedVertices[0].polygon, [vs[0], vs[1]]];
    }

    initiateSplit = () => {
        if (!this.isActive()) { return; }
        const [polygon, [start, end]] = this.selectedVertices;
        dispatch(clearSelection());
        dispatch(actions.splitPolygon({polygon: polygon.id, start, end}))
    }   

}