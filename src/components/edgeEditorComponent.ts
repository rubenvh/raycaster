import { MaterialEditorComponent } from './materialEditorComponent';
import { VertexEditorComponent } from './vertexEditorComponent';
import { connect } from '../store/store-connector';
import { IEntityKey } from '../geometry/entity';
import { useAppDispatch } from '../store';
import { isEdge } from '../selection/selectable';
import { IEdge } from '../geometry/edge';
import { queryEdge } from '../geometry/geometry';
import { adaptEdges } from '../store/walls';
import { Color } from '../geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><span id="label_id">id:</span><span id="identifier"></span></div>
<div><span id="label_immaterial">immaterial:</span><input id="immaterial" type="checkbox" /></div>
<div><span id="label_start">start:</span><vertex-editor id="start" hideId></vertex-editor></div>
<div><span id="label_end">end:</span><vertex-editor id="end" hideId></vertex-editor></div>
<div><span id="label_material">material:</span><material-editor id="material"></material-editor></div>
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

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = shadowRoot.querySelector('#identifier');
        this.immaterialElement = shadowRoot.querySelector('#immaterial');
        this.startElement = shadowRoot.querySelector('#start');
        this.endElement = shadowRoot.querySelector('#end');
        this.materialElement = shadowRoot.querySelector('#material');

        this.immaterialElement.addEventListener('change', (event) => {                       
            this.adaptEdge(_ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            });
        });        

        this.materialElement.addEventListener('change', (event: CustomEvent) => {
            this.adaptEdge(_ => {
                // TODO handle directed materials:
                const m = Array.isArray(_.material) ? _.material[0] : _.material;                    
                m.color = (<Color>event.detail);
                return _;
            });
        });

        connect(state => {
            const selectedElement = state.selection.treeSelection;            
            if (isEdge(selectedElement)) 
                this.updateEdge(
                    queryEdge(selectedElement.edge.id, selectedElement.polygon.id, state.walls.geometry),
                    selectedElement.polygon.id);
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
            this.materialElement.updateMaterial(Array.isArray(edge.material) ? edge.material[0] : edge.material);
            this.render();
        }
    }

    private render() {
        this.idElement.innerText = this._edge.id;
        this.immaterialElement.checked = this._edge.immaterial ?? false;
    }
}

window.customElements.define('edge-editor', EdgeEditorComponent);