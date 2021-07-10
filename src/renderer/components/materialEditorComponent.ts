import { ITextureSource } from './../../common/textures/model';
import ColorEditorComponent from './colorEditorComponent';
import { IMaterial } from '../../common/geometry/properties';
import TextureSelectorComponent from './textureSelectorComponent';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><color-editor id="color"></color-editor></div>
<div><texture-selector id="texture" dropdown="true"></texture-selector></div>
<div><span id="label_lumen">lumen override</span><input type="number" id="lumen" min="0" max="1" /></div>
`;

export default class MaterialEditorComponent extends HTMLElement {
    private _material: IMaterial;
    private colorElement: ColorEditorComponent;
    private lumenElement: HTMLInputElement;
    private textureElement: TextureSelectorComponent;
    private _sources: ITextureSource[];

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.colorElement = <ColorEditorComponent>shadowRoot.querySelector('#color');           
        this.lumenElement = <HTMLInputElement>shadowRoot.querySelector('#lumen');   
        this.textureElement = <TextureSelectorComponent>shadowRoot.querySelector('#texture');

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
        this.colorElement.color = this._material.color;
        this.lumenElement.value = this._material.luminosity?.toString() || '';    
        this.textureElement.value = this._material.texture;        
    }
}

window.customElements.define('material-editor', MaterialEditorComponent);