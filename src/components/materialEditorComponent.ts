import { ColorEditorComponent } from './colorEditorComponent';
import { Color, IMaterial } from '../geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><color-editor id="color"></color-editor></div>
<div><span id="label_lumen">lumen override</span><input type="number" id="lumen" min="0" max="1" /></div>
`;

export class MaterialEditorComponent extends HTMLElement {
    private _material: IMaterial;
    private colorElement: ColorEditorComponent;
    private lumenElement: HTMLInputElement;
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.colorElement = shadowRoot.querySelector('#color');           
        this.lumenElement = shadowRoot.querySelector('#lumen');   

        this.colorElement.addEventListener('change', this.onMaterialChanged);
        this.lumenElement.addEventListener('change', this.onMaterialChanged);
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
            luminosity: this.lumenElement.value != null && +this.lumenElement.value || null
        };
    }

    private render() {    
        this.colorElement.color = this._material.color;
        this.lumenElement.value = this._material.luminosity?.toString() || '';    
    }
}

window.customElements.define('material-editor', MaterialEditorComponent);