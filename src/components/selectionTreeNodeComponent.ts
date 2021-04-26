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
<span id="title" class="caret"></span>
<ul id="children">
</ul>
`;

export class SelectionTreeNodeComponent extends HTMLElement {
    
    private listElement: HTMLUListElement;
    private _node: ISelectionTreeNode;
    private titleElement: HTMLElement;
    private _isRoot: boolean = true;
    private _root: SelectionTreeNodeComponent;
    private _children: SelectionTreeNodeComponent[] = [];

    constructor() {
        super();
        // attach Shadow DOM to the parent element.
        // save the shadowRoot in a property because, if you create your shadow DOM in closed mode, 
        // you have no access from outside
        const shadowRoot = this.attachShadow({mode: 'closed'});
        // clone template content nodes to the shadow DOM
        shadowRoot.appendChild(template.content.cloneNode(true));
        //document.createElement('selection-tree-node')

        this.titleElement = shadowRoot.getElementById('title');
        this.listElement = shadowRoot.getElementById('children') as HTMLUListElement;
        this.isRoot = true;
        this.root = this;

        this.titleElement.addEventListener('click', (event) => {                    
          event.stopPropagation();                          
          this._root.deselect();
          this.titleElement.classList.add("selected");
          this.dispatchEvent(new CustomEvent('selected', { detail: this._node.element, bubbles: true }));          
        });
    }

    set root ( value) {
      this._root = value;
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
              this.titleElement.addEventListener('click', (event) => {                    
                event.stopPropagation();                
                this.listElement.classList.toggle('active');
                this.titleElement.classList.toggle("caret-down");
              });
            } else {this.titleElement.classList.remove('caret'); }

            this.render();
        }
    }
      
    get data() {
        return this._node;
    }

    deselect() {
      this.titleElement.classList.remove('selected');
      this._children.forEach(c => c.deselect());
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

            remove.forEach(_ => {
              //TODO: remove _.querySelector('selection-tree-node')
              _.remove();
            } );                

            children = children.filter(c => !keep.some(e => e.getAttribute('data-id') == selectedId(c.element)));            
        }
                
        const items = children
            .map(c => {
                const li = document.createElement("li");            
                li.setAttribute('data-id', selectedId(c.element));
                const subTreeNode = document.createElement('selection-tree-node') as SelectionTreeNodeComponent;                
                subTreeNode.isRoot = false;
                subTreeNode.root = this._root;
                subTreeNode.data = c;                
                //subTreeNode.addEventListener('selected', (event) => console.log(event));
               
                this._children.push(subTreeNode);
                li.appendChild(subTreeNode);

                return li;
            });        
        this.listElement.append(...items);        
    }   
    
    
}

window.customElements.define('selection-tree-node', SelectionTreeNodeComponent);