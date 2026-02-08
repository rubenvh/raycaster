import { connect } from "../../common/store/store-connector";
import { ITextureSource } from "../../common/textures/model";
import TextureSourceEditorElement from "./textureSourceEditorComponent";

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
#container {    
    display: flex;
    flex-flow: column;    
    align-content: flex-start;
    width: 210px;
}
.containerElement {
    display: flex;
    flex-flow: row;
    width: 100%;
}
.label {
    min-width: 5em; 
    float: left;   
}
select {
    width: 130px;
}

</style>
<p>Texture editor</p>
<div id="container">
    <div class="containerElement">
        <span class="label">source:</span>
        <select name="sources" id="sources"></select>
    </div>
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