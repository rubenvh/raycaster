import { SelectableElement, isGroup } from '../../common/selection/selectable';
import { ISelectionTreeNode } from '../../common/selection/selection-tree';
import { selectedId } from '../../common/selection/selectable';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
}
ul {
    list-style-type: none;
    margin: 0;
    padding-left: 12px;
}
.root {
    margin: 0;
    padding: 0;
}
.caret {
    cursor: pointer;
    user-select: none;
}
.caret::before {
    content: "\u25B6";
    color: #aaa;
    display: inline-block;
    margin-right: 6px;
    font-size: 9px;
    transition: transform 0.15s ease;
}
.caret-down::before {
    transform: rotate(90deg);
}
.nested {
    display: none;
}
.active {
    display: block;
}
#title {
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 2px;
    transition: background 0.1s;
}
#title:hover {
    background: #333;
}
.selected {
    background-color: #42a5f5 !important;
    color: #fff;
}
</style>
<span id="expander" class="caret"></span>
<span id="title"></span>
<ul id="children">
</ul>
`;

export default class SelectionTreeNodeComponent extends HTMLElement {
    
    private listElement: HTMLUListElement;    
    private titleElement: HTMLElement;
    private expanderElement: HTMLElement;

    private _node: ISelectionTreeNode;
    private _isRoot: boolean = true;    
    private _children: SelectionTreeNodeComponent[] = [];    

    constructor() {
        super();        
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));
        
        this.expanderElement = shadowRoot.getElementById('expander');
        this.titleElement = shadowRoot.getElementById('title');
        this.listElement = shadowRoot.getElementById('children') as HTMLUListElement;
        this.isRoot = true;
        
        this.titleElement.addEventListener('click', (event) => {                    
          event.stopPropagation();   
          this.dispatchEvent(new CustomEvent('selected', { detail: this._node.element, bubbles: true, composed: true}));             
        });
    }
    
    set isRoot(value) {
        this._isRoot = value;
        this.updateRootDisplay();
        if (value) {
          this.listElement.classList.add('root');          
        } else {          
          this.listElement.classList.remove('root');
          this.listElement.classList.add('nested');          
        }        
    }

    private updateRootDisplay() {
        // Root node is hidden unless it has a group element (multi-selection)
        const hasGroupElement = this._isRoot && this._node?.element && isGroup(this._node.element);
        this.titleElement.hidden = this._isRoot && !hasGroupElement;
        this.expanderElement.hidden = this._isRoot && !hasGroupElement;
        if (hasGroupElement) {
            // Switch from root (always visible) to nested+active (collapsible)
            this.listElement.classList.remove('root');
            this.listElement.classList.add('nested', 'active');
            this.expanderElement.classList.add('caret', 'caret-down');
        }
    }

    set data(value) {
        if (value !== this._node) {
            this._node = value;

            if (value.children.length > 0) {                   
              this.expanderElement.addEventListener('click', (event) => {                    
                event.stopPropagation();                
                this.listElement.classList.toggle('active');
                this.expanderElement.classList.toggle("caret-down");
              });
            } else {this.expanderElement.classList.remove('caret'); }

            this.render();           
        }
    }
      
    get data() {
        return this._node;
    }

    select(e : SelectableElement): void {
      if (!e) { 
        this.titleElement.classList.remove('selected');        
      }
      this._children.map(c => c.select(e));
      if (this._node.element === e) {
        this.titleElement.classList.add('selected');        
      } else {
        this.titleElement.classList.remove('selected');        
      }
      
    }            
    
    private render() {    

        if (this._node.element) {            
            this.titleElement.innerHTML = isGroup(this._node.element) 
                ? `selection (${this._node.element.elements.length})`
                : this._node.element.kind;            
        }
        this.updateRootDisplay();

        let children = this._node.children;            
        if (this._isRoot) {
            const [keep, remove] = Array.from(this.listElement.children).reduce((acc, e) => 
            this._node.children.map(c => selectedId(c.element)).includes(e.getAttribute('data-id')) 
            ? [[...acc[0], e], acc[1]]
            : [acc[0], [...acc[1], e]], [[],[]] as [HTMLElement[], HTMLElement[]]);

            remove.forEach(_ => _.remove());                
            children = children.filter(c => !keep.some(e => e.getAttribute('data-id') == selectedId(c.element)));            
        }
                
        const items = children
            .map(c => {
                const li = document.createElement("li");            
                li.setAttribute('data-id', selectedId(c.element));
                const subTreeNode = document.createElement('selection-tree-node') as SelectionTreeNodeComponent;                
                subTreeNode.isRoot = false;
                subTreeNode.data = c;                                                               
                li.appendChild(subTreeNode);
                return li;
            });        
        this.listElement.append(...items);   
        this._children = Array.from(this.listElement.querySelectorAll('selection-tree-node')).map(x => x as SelectionTreeNodeComponent);        

    }   
}

window.customElements.define('selection-tree-node', SelectionTreeNodeComponent);