import { useAppDispatch } from '../../common/store';
import { selectTreeNode } from '../../common/store/selection';
import { connect } from '../../common/store/store-connector';
import SelectionTreeNodeComponent from './selectionTreeNodeComponent';

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
<h3>Selection</h3>
<selection-tree-node id="tree"></selection-tree-node>
`;

const dispatch = useAppDispatch();

export default class GeometrySelectionComponent extends HTMLElement {
    
    
    private tree: SelectionTreeNodeComponent;
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.tree = shadowRoot.getElementById('tree') as SelectionTreeNodeComponent;
        this.tree.addEventListener('selected', (event: CustomEvent) => {                    
          event.stopPropagation();                                              
          // dispatch tree selection changed (to highlight selection in 2d view)       
          dispatch(selectTreeNode(event.detail));
        });

        connect(state => {
            this.tree.data = state.selection.tree;
            this.tree.select(state.selection.treeSelection);
        });
    }     
}

window.customElements.define('geometry-selection', GeometrySelectionComponent);