import { ColorEditorComponent } from './colorEditorComponent';
import { Color, IMaterial } from '../geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><color-editor id="color"></color-editor></div>
`;

export class MaterialEditorComponent extends HTMLElement {
    private _material: IMaterial;
    private colorElement: ColorEditorComponent;
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.colorElement = shadowRoot.querySelector('#color');   
        this.colorElement.addEventListener('change', (event: CustomEvent<Color>) => {            
            this.dispatchEvent(new CustomEvent('change', { detail: event.detail, bubbles: true, composed: true }));
        });
    } 

    public updateMaterial (material: IMaterial) {
        if (this._material !== material) {
            this._material = material;            
            this.colorElement.update(this._material.color);
            this.render();
        }
    }   

    private render() {        
    }
}

window.customElements.define('material-editor', MaterialEditorComponent);