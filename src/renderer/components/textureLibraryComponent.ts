import { connect } from "../../common/store/store-connector";
import { ITextureSource } from "../../common/textures/model";
import TextureSourceEditorElement from "./textureSourceEditorComponent";

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div>    
</div>
`;
/// …

export default class TextureLibraryElement extends HTMLElement {
    
    private element: HTMLDivElement;
    sources: ITextureSource[] = [];

    constructor() {
        super();
        // attach Shadow DOM to the parent element.
        // save the shadowRoot in a property because, if you create your shadow DOM in closed mode, 
        // you have no access from outside
        const shadowRoot = this.attachShadow({mode: 'closed'});
        // clone template content nodes to the shadow DOM
        shadowRoot.appendChild(template.content.cloneNode(true));
        
        this.element = shadowRoot.querySelector('div');

        connect(state => {
            if (this.sources !== state.textures.sources) {
                this.sources =state.textures.sources;
                this.render();
            }           
        });
    }

    
    // set data(value) {
    //     if (value !== this._stats) {
    //         this._stats = value;
    //         this.render();
    //     }
    // }
      
    // get data() {
    //     return this._stats;
    // }


    private render() {        
        this.sources.map(s => {
            let editor = document.createElement('texture-source-editor') as TextureSourceEditorElement
            this.element.append(editor);
            editor.textureSource = s;
        })
    }    
}

window.customElements.define('texture-library', TextureLibraryElement);