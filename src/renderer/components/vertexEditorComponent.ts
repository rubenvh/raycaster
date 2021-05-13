import { connect } from '../../common/store/store-connector';
import { IEntityKey } from '../../common/geometry/entity';
import { useAppDispatch } from '../../common/store';
import { IVertex } from '../../common/geometry/vertex';
import { editVertex } from '../../common/store/walls';
import { Vector } from '../../common/math/vector';
import { isVertex } from '../../common/selection/selectable';
import { queryVertex } from '../../common/geometry/geometry';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><span id="label_id">id:</span><span id="identifier"></span></div>
<div><span id="label_x">x:</span><input id="x" type="number" min="0" name="x" /></div>
<div><span id="label_y">y:</span><input id="y" type="number" min="0" name="y" /></div>
`;

const dispatch = useAppDispatch();

export default class VertexEditorComponent extends HTMLElement {
    private _vertex: IVertex;
    private _polygonId: IEntityKey;
    private idElement: HTMLElement;
    private xElement: HTMLInputElement;
    private yElement: HTMLInputElement;
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = shadowRoot.querySelector('#identifier');
        this.xElement = shadowRoot.querySelector('#x');
        this.yElement = shadowRoot.querySelector('#y');        

        this.xElement.addEventListener('change', (event) => {
            const x = +(<HTMLInputElement>event.target).value;            
            const direction: Vector = [x-this._vertex.vector[0], 0];            
            dispatch(editVertex({direction, vertex: this._vertex, polygonId: this._polygonId }));
        });
        this.yElement.addEventListener('change', (event) => {
            const y = +(<HTMLInputElement>event.target).value;
            const direction: Vector = [0, y-this._vertex.vector[1]];
            dispatch(editVertex({direction, vertex: this._vertex, polygonId: this._polygonId }));
        });

        connect(state => {
            const selectedElement = state.selection.treeSelection;            
            if (isVertex(selectedElement))
                this.updateVertex(
                    queryVertex(selectedElement.vertex.id, selectedElement.polygon.id, state.walls.geometry),
                    selectedElement.polygon.id);
        });
    } 

    public updateVertex (vertex: IVertex, poligonId: IEntityKey) {
        if (this._vertex !== vertex) {
            this._vertex = vertex;
            this._polygonId = poligonId;
            this.render();
        }
    }

    get hideIdentifier() {
        return this.hasAttribute('hideId');
    }
      
    set hideIdentifier(isHidden) {
        if (isHidden) {
            this.setAttribute('hideId', '');
        } else {
            this.removeAttribute('hideId');
        }
    }    

    private render() {
        this.idElement.innerText = this._vertex.id;
        this.idElement.parentElement.hidden = this.hideIdentifier;
        this.xElement.value = this._vertex.vector[0].toString();
        this.yElement.value = this._vertex.vector[1].toString();
    }
}

window.customElements.define('vertex-editor', VertexEditorComponent);