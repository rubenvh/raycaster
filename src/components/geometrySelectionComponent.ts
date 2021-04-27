import { useAppDispatch } from '../store';
import { selectTreeNode } from '../store/selection';
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
          this.tree.deselect();
          
          // TODO: send selection to edit component   
          
          // dispatch tree selection changed (to highlight selection in 2d view)       
          dispatch(selectTreeNode(event.detail));
        });
    } 

    set data (value) {
        this.tree.data = value;
    }
}

window.customElements.define('geometry-selection', GeometrySelectionComponent);