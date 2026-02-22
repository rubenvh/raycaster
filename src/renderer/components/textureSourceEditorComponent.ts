import { useAppDispatch } from '../../common/store';
import * as actions from '../../common/store/textures';
import { ITextureSource } from './../../common/textures/model';
import TextureSelectorComponent from './texture-selector.component';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
    margin-top: 4px;
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
.value {
    color: #eee;
}
input[type="number"] {
    background: #333;
    border: 1px solid #555;
    color: #eee;
    font-family: monospace;
    font-size: 11px;
    padding: 1px 4px;
    width: 4em;
    border-radius: 2px;
}
input[type="number"]:focus {
    outline: none;
    border-color: #42a5f5;
}
.separator {
    color: #666;
}
</style>
<div class="row"><span class="label">dims:</span><span id="dimensions" class="value"></span></div>
<div class="row"><span class="label">size:</span><input id="width" type="number" min="0" name="width" /><span class="separator">&times;</span><input id="height" type="number" min="0" name="height" /></div>
<texture-selector id="selector"></texture-selector>
`;
/// …
const dispatch = useAppDispatch();
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

        this.widthElement.addEventListener('change', this.changeTextureSize.bind(this));
        this.heightElement.addEventListener('change', this.changeTextureSize.bind(this));
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


    private changeTextureSize() {        
        const action = {id: this._source.id, 
            textureWidth: +this.widthElement.value, 
            textureHeight: +this.heightElement.value };
        dispatch(actions.adaptTexture(action));
    }

    private render() {                     
        this.dimElement.innerText = `${this._source.totalWidth} ⨯ ${this._source.totalHeight}`;        
        this.widthElement.value = this._source.textureWidth.toString();
        this.heightElement.value = this._source.textureHeight.toString();                  
    }    
}

window.customElements.define('texture-source-editor', TextureSourceEditorElement);