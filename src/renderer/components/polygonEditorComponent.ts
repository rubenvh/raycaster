import { connect } from '../../common/store/store-connector';
import { useAppDispatch } from '../../common/store';
import { isPolygon } from '../../common/selection/selectable';
import { queryPolygon } from '../../common/geometry/geometry';
import { IPolygon, isConvex } from '../../common/geometry/polygon';
import { IEdge } from '../../common/geometry/edge';
import { IEntityKey } from '../../common/geometry/entity';
import { adaptEdges } from '../../common/store/walls';
import DirectedMaterialEditorComponent from './directed-material.component';
import { cloneMaterial } from '../../common/geometry/properties';

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
.section {
    margin-bottom: 6px;
}
.section-label {
    color: #999;
    font-size: 10px;
    text-transform: uppercase;
    margin-bottom: 2px;
    margin-top: 6px;
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
<div class="section">
    <div class="row"><span class="label">id:</span><span id="identifier" class="value"></span></div>
    <div class="row"><span class="label">convex:</span><input id="convex" type="checkbox" /></div>
    <div class="row"><span class="label">edges:</span><span id="edge_count" class="value"></span></div>
</div>
<div class="section">
    <div class="row"><span class="label">immaterial:</span><input id="immaterial" type="checkbox" /></div>
</div>
<div class="section">
    <div class="section-label">Material</div>
    <directed-material-editor id="material"></directed-material-editor>
</div>
<div class="section">
    <div class="label">vertices:</div>
    <div id="json" class="json"></div>
</div>
`;

const dispatch = useAppDispatch();

export default class PolygonEditorComponent extends HTMLElement {
    private _polygon: IPolygon;
    private idElement: HTMLElement;
    private convexElement: HTMLInputElement;
    private edgeCountElement: HTMLElement;
    private immaterialElement: HTMLInputElement;
    private materialElement: DirectedMaterialEditorComponent;
    private jsonElement: HTMLElement;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = <HTMLElement>shadowRoot.querySelector('#identifier');
        this.convexElement = <HTMLInputElement>shadowRoot.querySelector('#convex');
        this.convexElement.disabled = true;
        this.edgeCountElement = <HTMLElement>shadowRoot.querySelector('#edge_count');
        this.immaterialElement = <HTMLInputElement>shadowRoot.querySelector('#immaterial');
        this.materialElement = <DirectedMaterialEditorComponent>shadowRoot.querySelector('#material');
        this.jsonElement = <HTMLElement>shadowRoot.querySelector('#json');

        this.immaterialElement.addEventListener('change', (event) => {
            this.adaptAllEdges(_ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            });
        });

        this.materialElement.addEventListener('change', this.changeMaterial);

        connect(state => {
            this.materialElement.selectableTextures = state.textures?.sources ?? [];
            const selectedElement = state.selection.treeSelection;                                    
            if (isPolygon(selectedElement)) {
                let polygon = queryPolygon(selectedElement.polygon.id, state.walls.geometry);
                this.updatePolygon(polygon);
            }            
        });
    }   

    private changeMaterial = (_: Event) => {
        this.adaptAllEdges(_ => {
            _.material = this.materialElement.material;
            return _;
        });
    }

    private adaptAllEdges = (transformer: ((edge: IEdge) => IEdge)): void => {
        if (!this._polygon) return;
        dispatch(adaptEdges({
            edgeMap: new Map<IEntityKey, IEdge[]>([[this._polygon.id, this._polygon.edges]]),
            transformer
        }));
    };
   
    public updatePolygon (polygon: IPolygon) {
        if (this._polygon !== polygon) {
            this._polygon = polygon;            
            this.render();
        } 
    }
    
    private render() {
        this.idElement.innerText = this._polygon.id;
        this.convexElement.checked = isConvex(this._polygon);
        this.edgeCountElement.innerText = String(this._polygon.edgeCount);
        this.immaterialElement.checked = this._polygon.edges[0]?.immaterial ?? false;
        this.materialElement.material = this._polygon.edges[0]?.material;
        this.jsonElement.innerText = JSON.stringify(this._polygon.vertices.map(v => v.vector));
    }

   
}

window.customElements.define('polygon-editor', PolygonEditorComponent);
