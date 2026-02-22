import { distanceToMidPoint } from '../../common/math/lineSegment';
import VertexEditorComponent from './vertexEditorComponent';
import { connect } from '../../common/store/store-connector';
import { IEntityKey } from '../../common/geometry/entity';
import { useAppDispatch } from '../../common/store';
import { isEdge } from '../../common/selection/selectable';
import { IEdge } from '../../common/geometry/edge';
import { queryEdge } from '../../common/geometry/geometry';
import { adaptEdges } from '../../common/store/walls';
import DirectedMaterialEditorComponent from './directed-material.component';

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
    min-width: 6em;
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
.stat-row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
}
.stat-label {
    color: #aaa;
}
.stat-value {
    color: #eee;
    text-align: right;
}
</style>
<div class="section">
    <div class="row"><span class="label">id:</span><span id="identifier" class="value"></span></div>
    <div class="row"><span class="label">immaterial:</span><input id="immaterial" type="checkbox" /></div>
</div>
<div class="section">
    <div class="section-label">Start</div>
    <vertex-editor id="start" hideId></vertex-editor>
</div>
<div class="section">
    <div class="section-label">End</div>
    <vertex-editor id="end" hideId></vertex-editor>
</div>
<div class="section">
    <div class="section-label">Material</div>
    <directed-material-editor id="material"></directed-material-editor>
</div>
<div class="section">
    <div class="section-label">Stats</div>
    <div id="stats"></div>
</div>
`;

const dispatch = useAppDispatch();

export default class EdgeEditorComponent extends HTMLElement {
    private _edge: IEdge;
    private _polygonId: IEntityKey;
    private idElement: HTMLElement;
    private immaterialElement: HTMLInputElement;
    private startElement: VertexEditorComponent;
    private endElement: VertexEditorComponent;
    private materialElement: DirectedMaterialEditorComponent;
    private statsElement: HTMLElement;
    private distanceToCamera: (edge: IEdge) => number;    

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = <HTMLElement>shadowRoot.querySelector('#identifier');
        this.immaterialElement = <HTMLInputElement>shadowRoot.querySelector('#immaterial');
        this.startElement = <VertexEditorComponent>shadowRoot.querySelector('#start');
        this.endElement = <VertexEditorComponent>shadowRoot.querySelector('#end');
        this.statsElement = shadowRoot.querySelector('#stats');
        this.materialElement = <DirectedMaterialEditorComponent>shadowRoot.querySelector('#material');

        this.immaterialElement.addEventListener('change', (event) => {                       
            this.adaptEdge(_ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            });
        });        

        this.materialElement.addEventListener('change', this.changeMaterial);       

        connect(state => {
            this.materialElement.selectableTextures = state.textures?.sources ?? [];             
            const selectedElement = state.selection.treeSelection;                        
            this.distanceToCamera = (edge: IEdge): number => distanceToMidPoint(state.player.camera.position, edge.segment);
            if (isEdge(selectedElement)) {
                let edge = queryEdge(selectedElement.edge.id, selectedElement.polygon.id, state.walls.geometry);                
                if (edge) {
                    this.updateEdge(edge, selectedElement.polygon.id);
                }
            }
        });
    } 
  
    private changeMaterial = (_: Event) => {
        this.adaptEdge(_ => {
            _.material = this.materialElement.material;
            return _;
        });
    }
    private adaptEdge = (transformer: ((edge: IEdge) => IEdge)): void => {
        dispatch(adaptEdges({edgeMap: new Map<string, IEdge[]>([[this._polygonId, [this._edge]]]),
            transformer}));
    };

    public updateEdge (edge: IEdge, poligonId: IEntityKey) {
        if (this._edge !== edge) {
            this._edge = edge;
            this._polygonId = poligonId;
            this.startElement.updateVertex(edge.start, poligonId);
            this.endElement.updateVertex(edge.end, poligonId);
            this.materialElement.material = edge.material;    
            this.render();
        } else {
            this.renderStats();
        }
    }
    
    private render() {
        this.idElement.innerText = this._edge.id;
        this.immaterialElement.checked = this._edge.immaterial ?? false;                                
        this.renderStats();
    }

    private renderStats() {
        this.statsElement.innerHTML = `
            <div class="stat-row"><span class="stat-label">auto-lumen</span><span class="stat-value">${this._edge.luminosity.toFixed(2)}</span></div>
            <div class="stat-row"><span class="stat-label">length</span><span class="stat-value">${this._edge.length.toFixed(2)}</span></div>
            <div class="stat-row"><span class="stat-label">distance</span><span class="stat-value">${this.distanceToCamera(this._edge).toFixed(2)}</span></div>`;
    }
}

window.customElements.define('edge-editor', EdgeEditorComponent);