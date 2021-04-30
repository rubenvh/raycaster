import { IGeometry, queryVertex } from './../geometry/geometry';
import { VertexEditorComponent } from './vertexEditorComponent';
import { SelectableElement, isVertex } from '../selection/selectable';
import { useAppDispatch } from '../store';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<vertex-editor id="vertex"></vertex-editor>
`;

const dispatch = useAppDispatch();

export class GeometryEditorComponent extends HTMLElement {
    private vertexEditor: VertexEditorComponent;
    private _selectedElement: SelectableElement;
        
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        

        this.vertexEditor = shadowRoot.getElementById('vertex') as VertexEditorComponent;
        this.vertexEditor.hidden = true;
    } 

    updateEditor(selectedElement: SelectableElement, geometry: IGeometry) {
        if (isVertex(selectedElement))
            this.vertexEditor.updateVertex(
                queryVertex(selectedElement.vertex.id, selectedElement.polygon.id, geometry),
                selectedElement.polygon.id);

        if (this._selectedElement !== selectedElement) {
            this._selectedElement = selectedElement;
            this.vertexEditor.hidden = !isVertex(selectedElement);
        }        
    }
}

window.customElements.define('geometry-editor', GeometryEditorComponent);