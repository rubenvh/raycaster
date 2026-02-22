import { connect } from '../../common/store/store-connector';
import { useAppDispatch } from '../../common/store';
import { isPolygon } from '../../common/selection/selectable';
import { queryPolygon } from '../../common/geometry/geometry';
import { IPolygon, isConvex } from '../../common/geometry/polygon';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
}
:host([hidden]) {
    display: none;
}
.row {
    display: flex;
    align-items: center;
    padding: 1px 0;
    gap: 4px;
}
.label {
    color: #aaa;
    min-width: 5em;
}
.value {
    color: #eee;
}
input[type="checkbox"] {
    accent-color: #42a5f5;
}
.json {
    color: #999;
    font-size: 10px;
    word-break: break-all;
    margin-top: 4px;
    padding: 4px;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 2px;
}
</style>
<div class="row"><span class="label">id:</span><span id="identifier" class="value"></span></div>
<div class="row"><span class="label">convex:</span><input id="convex" type="checkbox" /></div>
<div class="label">vertices:</div>
<div id="json" class="json"></div>
`;

const dispatch = useAppDispatch();

export default class PolygonEditorComponent extends HTMLElement {
    private _polygon: IPolygon;
    private idElement: HTMLElement;
    private convexElement: HTMLInputElement;
    private jsonElement: HTMLElement;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = <HTMLElement>shadowRoot.querySelector('#identifier');
        this.convexElement = <HTMLInputElement>shadowRoot.querySelector('#convex');
        this.convexElement.disabled = true;
        this.jsonElement = <HTMLElement>shadowRoot.querySelector('#json');

        connect(state => {
            const selectedElement = state.selection.treeSelection;                                    
            if (isPolygon(selectedElement)) {
                let polygon = queryPolygon(selectedElement.polygon.id, state.walls.geometry);
                this.updatePolygon(polygon);
            }            
        });
    }   
   
    public updatePolygon (polygon: IPolygon) {
        if (this._polygon !== polygon) {
            this._polygon = polygon;            
            this.render();
        } 
    }
    
    private render() {
        this.idElement.innerText = this._polygon.id;
        this.convexElement.checked = isConvex(this._polygon);        
        this.jsonElement.innerText = JSON.stringify(this._polygon.vertices.map(v => v.vector));
    }

   
}

window.customElements.define('polygon-editor', PolygonEditorComponent);