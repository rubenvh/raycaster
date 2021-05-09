import { distanceToMidPoint } from './../math/lineSegment';
import { MaterialEditorComponent } from './materialEditorComponent';
import { VertexEditorComponent } from './vertexEditorComponent';
import { connect } from '../store/store-connector';
import { IEntityKey } from '../geometry/entity';
import { useAppDispatch } from '../store';
import { isEdge } from '../selection/selectable';
import { IEdge } from '../geometry/edge';
import { queryEdge } from '../geometry/geometry';
import { adaptEdges } from '../store/walls';
import { Color, IMaterial } from '../geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><span id="label_id">id:</span><span id="identifier"></span></div>
<div><span id="label_immaterial">immaterial:</span><input id="immaterial" type="checkbox" /></div>
<div><span id="label_start">start:</span><vertex-editor id="start" hideId></vertex-editor></div>
<div><span id="label_end">end:</span><vertex-editor id="end" hideId></vertex-editor></div>
<div><span id="label_material">material:</span><material-editor id="material"></material-editor></div>
<div><span id="label_stats">stats:</span>
<ul id="stats">    
</ul>
</div>
`;

const dispatch = useAppDispatch();

export class EdgeEditorComponent extends HTMLElement {
    private _edge: IEdge;
    private _polygonId: IEntityKey;
    private idElement: HTMLElement;
    private immaterialElement: HTMLInputElement;
    private startElement: VertexEditorComponent;
    private endElement: VertexEditorComponent;
    private materialElement: MaterialEditorComponent;
    private statsElement: HTMLUListElement;
    private distanceToCamera: (edge: IEdge) => number;
    

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = shadowRoot.querySelector('#identifier');
        this.immaterialElement = shadowRoot.querySelector('#immaterial');
        this.startElement = shadowRoot.querySelector('#start');
        this.endElement = shadowRoot.querySelector('#end');
        this.materialElement = shadowRoot.querySelector('#material');
        this.statsElement = shadowRoot.querySelector('#stats');

        this.immaterialElement.addEventListener('change', (event) => {                       
            this.adaptEdge(_ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            });
        });        

        this.materialElement.addEventListener('change', (event: CustomEvent<IMaterial>) => {
            this.adaptEdge(_ => {
                // TODO handle directed materials:
                const m = Array.isArray(_.material) ? _.material[0] : _.material;
                m.color = event.detail.color;
                m.luminosity = event.detail.luminosity;
                return _;
            });
        });

        connect(state => {
            const selectedElement = state.selection.treeSelection;                        
            this.distanceToCamera = (edge: IEdge): number => distanceToMidPoint(state.player.camera.position, edge.segment);
            if (isEdge(selectedElement)) {
                let edge = queryEdge(selectedElement.edge.id, selectedElement.polygon.id, state.walls.geometry);                
                this.updateEdge(edge, selectedElement.polygon.id);
            }            
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
            // TODO: directed material
            this.materialElement.material = Array.isArray(edge.material) ? edge.material[0] : edge.material;            
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
        this.statsElement.textContent = '';
        let automaticLuminosity = document.createElement('li');
        automaticLuminosity.textContent = `auto-lumen: ${this._edge.luminosity.toFixed(2)}`;
        let length = document.createElement('li');
        length.textContent = `length: ${this._edge.length.toFixed(2)}`;
        let distance = document.createElement('li');
        distance.textContent = `distance: ${this.distanceToCamera(this._edge).toFixed(2)}`;
        this.statsElement.append(automaticLuminosity, length, distance);
    }
}

window.customElements.define('edge-editor', EdgeEditorComponent);