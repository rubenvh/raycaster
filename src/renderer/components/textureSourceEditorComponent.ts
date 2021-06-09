import { ITextureSource } from './../../common/textures/model';
import { textureLib } from './../../common/textures/textureLibrary';
import TextureSelectorComponent from './textureSelectorComponent';

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
input {
    min-width: 3em;
}
</style>
<div id="container">      
    <div class="containerElement"><span class="label">dimensions:</span><span id="dimensions"></span></div>
    <div class="containerElement"><span class="label">size:</span><input id="width" type="number" min="0" name="width" /> &Cross; <input id="height" type="number" min="0" name="height" /></div> 
    <texture-selector id="selector" class="containerElement"></texture-selector>
</div>
`;
/// …

export default class TextureSourceEditorElement extends HTMLElement {
        
    private _source: ITextureSource;   
    private dimElement: HTMLElement;
    private widthElement: HTMLInputElement;
    private heightElement: HTMLInputElement;    
    private selectorComponent: TextureSelectorComponent;

    constructor() {
        super();        
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));
        
        this.dimElement = shadowRoot.querySelector('#dimensions');
        this.widthElement = shadowRoot.querySelector('#width');
        this.heightElement = shadowRoot.querySelector('#height');    
        this.selectorComponent = shadowRoot.querySelector('#selector');

        this.selectorComponent.addEventListener('change', (e) => console.log(this.selectorComponent.value));
        
    }

    set textureSource (source: ITextureSource) {
        if (this._source !== source) {
            this._source = source;            
            this.selectorComponent.textures = [source]; // textureLib.textures;            
            this.render();
        }
    }

    get textureSource() {
         return this._source;
    }


    private render() {                     
        this.dimElement.innerText = `${this._source.totalWidth} ⨯ ${this._source.totalHeight}`;        
        this.widthElement.value = this._source.textureWidth.toString();
        this.heightElement.value = this._source.textureHeight.toString();                  
    }    
}

window.customElements.define('texture-source-editor', TextureSourceEditorElement);