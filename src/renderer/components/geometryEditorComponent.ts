import { connect } from '../../common/store/store-connector';
import VertexEditorComponent from './vertexEditorComponent';
import { SelectableElement, isVertex, isEdge, isPolygon, isGroup } from '../../common/selection/selectable';
import EdgeEditorComponent from './edgeEditorComponent';
import PolygonEditorComponent from './polygonEditorComponent';
import GroupEditorComponent from './groupEditorComponent';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
    padding: 4px 8px;
    overflow-y: auto;
}
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: rgba(0,0,0,0.9); }
::-webkit-scrollbar-thumb { background: rgba(125,125,125,0.7); border-radius: 2px; }
h3 {
    margin: 0 0 4px 0;
    font-size: 12px;
    color: #eee;
    border-bottom: 1px solid #444;
    padding-bottom: 2px;
    position: sticky;
    top: 0;
    z-index: 1;
    background: #2d2d2d;
}
</style>
<h3>Editor</h3>
<vertex-editor id="vertex"></vertex-editor>
<edge-editor id="edge"></edge-editor>
<polygon-editor id="polygon"></polygon-editor>
<group-editor id="group"></group-editor>
`;
export default class GeometryEditorComponent extends HTMLElement {
    private vertexEditor: VertexEditorComponent;
    private edgeEditor: EdgeEditorComponent;
    private polygonEditor: PolygonEditorComponent;    
    private groupEditor: GroupEditorComponent;
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
        this.groupEditor = shadowRoot.getElementById('group') as GroupEditorComponent;
        this.groupEditor.hidden = true;

        connect(state => {
            if (this._selectedElement !== state.selection.treeSelection) {
                this._selectedElement = state.selection.treeSelection;
                this.vertexEditor.hidden = !isVertex(state.selection.treeSelection);
                this.edgeEditor.hidden = !isEdge(state.selection.treeSelection);
                this.polygonEditor.hidden = !isPolygon(state.selection.treeSelection);
                this.groupEditor.hidden = !isGroup(state.selection.treeSelection);
            }     
        });
    }     
}

window.customElements.define('geometry-editor', GeometryEditorComponent);