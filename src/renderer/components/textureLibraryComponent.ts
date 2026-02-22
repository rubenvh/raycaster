import { connect } from "../../common/store/store-connector";
import { ITextureSource } from "../../common/textures/model";
import TextureSourceEditorElement from "./textureSourceEditorComponent";

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
.row {
    display: flex;
    align-items: center;
    padding: 1px 0;
    gap: 4px;
}
.label {
    color: #aaa;
    min-width: 5em;
}
select {
    background: #333;
    border: 1px solid #555;
    color: #eee;
    font-family: monospace;
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 2px;
    max-width: 130px;
}
select:focus {
    outline: none;
    border-color: #42a5f5;
}
</style>
<h3>Textures</h3>
<div class="row">
    <span class="label">source:</span>
    <select name="sources" id="sources"></select>
</div>
<texture-source-editor id="texture-source-editor"></texture-source-editor>
`;
/// …

export default class TextureLibraryElement extends HTMLElement {
    
    private sourcesElement: HTMLSelectElement;
    private sources: ITextureSource[] = [];
    private sourceEditor: TextureSourceEditorElement;

    constructor() {
        super();
        // attach Shadow DOM to the parent element.
        // save the shadowRoot in a property because, if you create your shadow DOM in closed mode, 
        // you have no access from outside
        const shadowRoot = this.attachShadow({mode: 'closed'});
        // clone template content nodes to the shadow DOM
        shadowRoot.appendChild(template.content.cloneNode(true));
                
        this.sourcesElement = shadowRoot.getElementById('sources') as HTMLSelectElement;
        this.sourcesElement.addEventListener('change', () => { this.sourceEditor.textureSource = this.sources.find(x => x.id === this.sourcesElement.value); } );
        
        this.sourceEditor = shadowRoot.getElementById('texture-source-editor') as TextureSourceEditorElement;
        
        connect(state => {
            if (this.sources !== state.textures.sources) {
                this.sources = state.textures.sources;                
                this.render();
            }           
        });
    }

    private render() {                

        const hasSources = this.sources.length > 0;
        this.sourcesElement.hidden = !hasSources;
        this.sourceEditor.hidden = !hasSources;
        if (!hasSources) { return; }

        const items = this.sources
        .map(c => {
            const option = document.createElement("option");              
            option.setAttribute('value', c.id);               
            option.innerText = c.id;            
            return option;
        });        
        
        this.sourcesElement.innerHTML = '';
        this.sourcesElement.append(...items);
        this.sourcesElement.selectedIndex = 0;  
        this.sourceEditor.textureSource = this.sources[0];
    }    
}

window.customElements.define('texture-library', TextureLibraryElement);