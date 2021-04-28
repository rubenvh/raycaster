import { useAppDispatch } from '../store';
import { IVertex } from '../geometry/vertex';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><span id="label_id"></span><span id="identifier"></span></div>
<div><span id="label_x"></span><span id="x"></span></div>
<div><span id="label_y"></span><span id="y"></span></div>
`;

const dispatch = useAppDispatch();

export class VertexEditorComponent extends HTMLElement {
    private _selectedVertex: IVertex;
    private idElement: HTMLElement;
    private xElement: HTMLElement;
    private yElement: HTMLElement;
        
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = shadowRoot.getElementById('identifier');
        this.xElement = shadowRoot.getElementById('x');
        this.yElement = shadowRoot.getElementById('y');        
    } 

    set selectedVertex (value: IVertex) {
        if (this._selectedVertex !== value) {
            this._selectedVertex = value;
            this.render();
        }
    }

    private render() {
        this.idElement.innerText = this._selectedVertex.id;
        this.xElement.innerText = this._selectedVertex.vector[0].toString();
        this.yElement.innerText = this._selectedVertex.vector[1].toString();
    }
}

window.customElements.define('vertex-editor', VertexEditorComponent);