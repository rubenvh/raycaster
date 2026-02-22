import { ITextureSource } from './../../common/textures/model';
import ColorEditorComponent from './colorEditorComponent';
import { IMaterial } from '../../common/geometry/properties';
import TextureDropdownComponent from './texture-dropdown.component';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
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
</style>
<div class="row"><span class="label">color:</span><color-editor id="color"></color-editor></div>
<div class="row"><span class="label">lumen:</span><input type="number" id="lumen" min="0" max="1" step="0.1" /></div>
<div class="row"><span class="label">texture:</span><texture-dropdown id="texture"></texture-dropdown></div>
`;

export default class MaterialEditorComponent extends HTMLElement {
    private _material: IMaterial;
    private colorElement: ColorEditorComponent;
    private lumenElement: HTMLInputElement;
    private textureElement: TextureDropdownComponent;
    private _sources: ITextureSource[];

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.colorElement = <ColorEditorComponent>shadowRoot.querySelector('#color');           
        this.lumenElement = <HTMLInputElement>shadowRoot.querySelector('#lumen');   
        this.textureElement = <TextureDropdownComponent>shadowRoot.querySelector('#texture');

        this.colorElement.addEventListener('change', this.onMaterialChanged);
        this.lumenElement.addEventListener('change', this.onMaterialChanged);
        this.textureElement.addEventListener('change', this.onMaterialChanged);
    } 

    private onMaterialChanged = (event: Event) => {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('change', { detail: this.material, bubbles: true, composed: true }));
    };

    set material (material: IMaterial) {
        if (this._material !== material) {
            this._material = material;                        
            this.render();
        }
    }   

    get material(): IMaterial {
        return {...this._material,
            color: this.colorElement.color,
            texture: this.textureElement.value,
            luminosity: this.lumenElement.value != null && +this.lumenElement.value || null
        };
    }

    set selectableTextures (sources: ITextureSource[]) {
        if (this._sources !== sources) {
            this._sources = sources;
            this.textureElement.textures = this._sources;         
        }
    }

    private render() {    
        this.colorElement.color = this._material?.color || [0,0,0,0];
        this.lumenElement.value = this._material?.luminosity?.toString() || '';    
        this.textureElement.value = this._material?.texture;        
    }
}

window.customElements.define('material-editor', MaterialEditorComponent);