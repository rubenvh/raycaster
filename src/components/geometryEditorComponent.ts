import { connect } from './../store/store-connector';
import { VertexEditorComponent } from './vertexEditorComponent';
import { SelectableElement, isVertex } from '../selection/selectable';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<vertex-editor id="vertex"></vertex-editor>
`;
export class GeometryEditorComponent extends HTMLElement {
    private vertexEditor: VertexEditorComponent;
    private _selectedElement: SelectableElement;
        
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        

        this.vertexEditor = shadowRoot.getElementById('vertex') as VertexEditorComponent;
        this.vertexEditor.hidden = true;

        connect(state => {
            if (this._selectedElement !== state.selection.treeSelection) {
                this._selectedElement = state.selection.treeSelection;
                this.vertexEditor.hidden = !isVertex(state.selection.treeSelection);
            }     
        });
    }     
}

window.customElements.define('geometry-editor', GeometryEditorComponent);