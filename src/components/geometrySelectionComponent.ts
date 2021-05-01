import { useAppDispatch } from '../store';
import { selectTreeNode } from '../store/selection';
import { connect } from '../store/store-connector';
import { SelectionTreeNodeComponent } from './selectionTreeNodeComponent';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<selection-tree-node id="tree"></selection-tree-node>
`;

const dispatch = useAppDispatch();

export class GeometrySelectionComponent extends HTMLElement {
    
    
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