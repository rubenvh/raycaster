import { connect } from '../store/store-connector';
import { IEntityKey } from '../geometry/entity';
import { useAppDispatch } from '../store';
import { isEdge } from '../selection/selectable';
import { IEdge } from '../geometry/edge';
import { queryEdge } from '../geometry/geometry';
import { adaptEdges } from '../store/walls';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><span id="label_id">id:</span><span id="identifier"></span></div>
<div><span id="label_immaterial">immaterial:</span><input id="immaterial" type="checkbox" /></div>
`;

const dispatch = useAppDispatch();

export class EdgeEditorComponent extends HTMLElement {
    private _edge: IEdge;
    private _polygonId: IEntityKey;
    private idElement: HTMLElement;
    private immaterialElement: HTMLInputElement;
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = shadowRoot.querySelector('#identifier');
        this.immaterialElement = shadowRoot.querySelector('#immaterial');

        this.immaterialElement.addEventListener('change', (event) => {                       
           dispatch(adaptEdges({edgeMap: new Map<string, IEdge[]>([[this._polygonId, [this._edge]]]),
            transformer: _ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            }}));
        });        

        connect(state => {
            const selectedElement = state.selection.treeSelection;            
            if (isEdge(selectedElement))
                this.updateEdge(
                    queryEdge(selectedElement.edge.id, selectedElement.polygon.id, state.walls.geometry),
                    selectedElement.polygon.id);
        });
    } 

    public updateEdge (vertex: IEdge, poligonId: IEntityKey) {
        if (this._edge !== vertex) {
            this._edge = vertex;
            this._polygonId = poligonId;
            this.render();
        }
    }

    private render() {
        this.idElement.innerText = this._edge.id;
        this.immaterialElement.checked = this._edge.immaterial ?? false;
    }
}

window.customElements.define('edge-editor', EdgeEditorComponent);