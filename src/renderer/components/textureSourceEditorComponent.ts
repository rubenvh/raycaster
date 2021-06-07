import { ITextureSource } from './../../common/textures/model';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div>  
    <div><img width="100px" id="image"></img></div>
    <div><span id="label_id">id:</span><span id="identifier"></span></div>
    <div><span id="label_dimensions">dimensions:</span><span id="dimensions"></span></div>
    <div><span id="label_size">size:</span><input id="width" type="number" min="0" name="width" /> x <input id="height" type="number" min="0" name="height" /></div> 
</div>
`;
/// …

export default class TextureSourceEditorElement extends HTMLElement {
        
    private _source: ITextureSource;
    private idElement: HTMLElement;
    private dimElement: HTMLElement;
    private widthElement: HTMLInputElement;
    private heightElement: HTMLInputElement;
    private imageElement: HTMLImageElement;

    constructor() {
        super();
        // attach Shadow DOM to the parent element.
        // save the shadowRoot in a property because, if you create your shadow DOM in closed mode, 
        // you have no access from outside
        const shadowRoot = this.attachShadow({mode: 'closed'});
        // clone template content nodes to the shadow DOM
        shadowRoot.appendChild(template.content.cloneNode(true));

        this.imageElement = shadowRoot.querySelector('#image');
        this.idElement = shadowRoot.querySelector('#identifier');
        this.dimElement = shadowRoot.querySelector('#dimensions');
        this.widthElement = shadowRoot.querySelector('#width');
        this.heightElement = shadowRoot.querySelector('#height');    

        
    }

    set textureSource (source: ITextureSource) {
        if (this._source !== source) {
            this._source = source;
            this.render();
        }
    }

    get textureSource() {
         return this._source;
    }


    private render() {             
        this.imageElement.src = `data:image/png;base64,${this._source.data}`;        
        this.idElement.innerText = this._source.id;
        this.dimElement.innerText = `${this._source.totalWidth} x ${this._source.totalHeight}`;        
        this.widthElement.value = this._source.textureWidth.toString();
        this.heightElement.value = this._source.textureHeight.toString();     
    }    
}

window.customElements.define('texture-source-editor', TextureSourceEditorElement);