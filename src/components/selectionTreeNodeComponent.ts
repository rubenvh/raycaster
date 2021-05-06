import { SelectableElement } from './../selection/selectable';
import { ISelectionTreeNode } from '../selection/selection-tree';
import { selectedId } from '../selection/selectable';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
ul {
  list-style-type: none;
}
.root {
  margin: 0;
  padding: 0;
}
/* Style the caret/arrow */
.caret {
  cursor: pointer;
  user-select: none; /* Prevent text selection */
}

/* Create the caret/arrow with a unicode, and style it */
.caret::before {
  content: "\u25B6";
  color: black;
  display: inline-block;
  margin-right: 6px;
}

/* Rotate the caret/arrow icon when clicked on (using JavaScript) */
.caret-down::before {
  transform: rotate(90deg);
}

/* Hide the nested list */
.nested {
  display: none;
}

/* Show the nested list when the user clicks on the caret/arrow (with JavaScript) */
.active {
  display: block;
}

.selected {
  background-color: blue;
}
</style>
<span id="expander" class="caret"></span>
<span id="title"></span>
<ul id="children">
</ul>
`;

export class SelectionTreeNodeComponent extends HTMLElement {
    
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
        this.titleElement.hidden = value;
        if (value) {
          this.listElement.classList.add('root');          
        } else {          
          this.listElement.classList.remove('root');
          this.listElement.classList.add('nested');          
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
            this.titleElement.innerHTML = this._node.element.kind;            
        }

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