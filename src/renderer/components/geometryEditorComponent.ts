import { connect } from '../../common/store/store-connector';
import VertexEditorComponent from './vertexEditorComponent';
import { SelectableElement, isVertex, isEdge, isPolygon } from '../../common/selection/selectable';
import EdgeEditorComponent from './edgeEditorComponent';
import PolygonEditorComponent from './polygonEditorComponent';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<vertex-editor id="vertex"></vertex-editor>
<edge-editor id="edge"></edge-editor>
<polygon-editor id="polygon"></polygon-editor>
`;
export default class GeometryEditorComponent extends HTMLElement {
    private vertexEditor: VertexEditorComponent;
    private edgeEditor: EdgeEditorComponent;
    private polygonEditor: PolygonEditorComponent;    
    private _selectedElement: SelectableElement;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        

        this.vertexEditor = shadowRoot.getElementById('vertex') as VertexEditorComponent;
        this.vertexEditor.hidden = true;
        this.edgeEditor = shadowRoot.getElementById('edge') as EdgeEditorComponent;
        this.edgeEditor.hidden = true;
        this.polygonEditor = shadowRoot.getElementById('polygon') as PolygonEditorComponent;
        this.polygonEditor.hidden = true;

        connect(state => {
            if (this._selectedElement !== state.selection.treeSelection) {
                this._selectedElement = state.selection.treeSelection;
                this.vertexEditor.hidden = !isVertex(state.selection.treeSelection);
                this.edgeEditor.hidden = !isEdge(state.selection.treeSelection);
                this.polygonEditor.hidden = !isPolygon(state.selection.treeSelection);
            }     
        });
    }     
}

window.customElements.define('geometry-editor', GeometryEditorComponent);