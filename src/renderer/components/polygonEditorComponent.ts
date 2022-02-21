import { connect } from '../../common/store/store-connector';
import { useAppDispatch } from '../../common/store';
import { isPolygon } from '../../common/selection/selectable';
import { queryPolygon } from '../../common/geometry/geometry';
import { IPolygon, isConvex } from '../../common/geometry/polygon';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><span id="label_id">id:</span><span id="identifier"></span></div>
<div><span id="label_isconvex">convex:</span><input id="convex" type="checkbox" /></div>
<div><span id="label_json">vertices:</span><span id="json"></span></div>
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