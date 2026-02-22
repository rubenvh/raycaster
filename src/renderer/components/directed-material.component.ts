import { ITextureSource } from '../../common/textures/model';
import MaterialEditorComponent from './materialEditorComponent';
import { IDirectedMaterial, hasDirection } from '../../common/geometry/properties';

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
}
.section-label {
    color: #999;
    font-size: 10px;
    text-transform: uppercase;
    margin-bottom: 2px;
    margin-top: 4px;
}
input[type="checkbox"] {
    accent-color: #42a5f5;
}
</style>
<div>
    <div class="row"><input id="double_sided" type="checkbox" /><span class="label">double-sided</span></div>
    <div class="section-label">Front</div>
    <material-editor id="front_material"></material-editor>
    <div id="back_section">
        <div class="section-label">Back</div>
        <material-editor id="back_material"></material-editor>
    </div>
</div>
`;

export default class DirectedMaterialEditorComponent extends HTMLElement {
    private _material: IDirectedMaterial;
    private frontMaterialElement: MaterialEditorComponent;
    private backMaterialElement: MaterialEditorComponent;
    private backSectionElement: HTMLElement;
    private doubleSidedMaterialElement: HTMLInputElement;
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
                
        this.doubleSidedMaterialElement = <HTMLInputElement>shadowRoot.querySelector('#double_sided');
        this.frontMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#front_material');
        this.backMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#back_material');
        this.backSectionElement = shadowRoot.querySelector('#back_section');

        this.doubleSidedMaterialElement.addEventListener('change', () => {         
            if (this.doubleSidedMaterialElement.checked) {
                this.backMaterialElement.material = {color: [0,0,0,0]};
            }

            this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        });       
    } 

    get material(): IDirectedMaterial {
        return this.doubleSidedMaterialElement.checked ? 
            [this.frontMaterialElement.material, this.backMaterialElement.material] 
            : this.frontMaterialElement.material;
    }

    set material(m: IDirectedMaterial) {
        if (this._material !== m) {
            this._material = m;
            this.render();
        }
    }

    set selectableTextures (sources: ITextureSource[]) {
        this.frontMaterialElement.selectableTextures = sources;
        this.backMaterialElement.selectableTextures = sources;
    }   
   
    private render() {
        this.doubleSidedMaterialElement.checked = hasDirection(this._material);
        this.frontMaterialElement.material = hasDirection(this._material) ? this._material[0] : this._material;
        this.backMaterialElement.material = hasDirection(this._material) ? this._material[1] : {color: [0,0,0,0]};
        this.backSectionElement.style.display = this.doubleSidedMaterialElement.checked ? 'block' : 'none';
    }

}

window.customElements.define('directed-material-editor', DirectedMaterialEditorComponent);