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
.slider-row {
    display: flex;
    align-items: center;
    padding: 1px 0;
    gap: 6px;
}
.slider-label {
    color: #aaa;
    min-width: 5em;
}
input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, #333, #ffc107);
    outline: none;
    cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #42a5f5;
    border: 1px solid #2979b5;
    cursor: pointer;
}
input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #42a5f5;
    border: 1px solid #2979b5;
    cursor: pointer;
}
.slider-value {
    color: #eee;
    font-size: 10px;
    min-width: 2.5em;
    text-align: right;
}
</style>
<div class="row"><span class="label">color:</span></div>
<color-editor id="color"></color-editor>
<div class="slider-row">
    <span class="slider-label">lumen:</span>
    <input type="range" id="lumen" min="0" max="1" step="0.05" />
    <span id="lumen-display" class="slider-value"></span>
</div>
<div class="row"><span class="label">texture:</span><texture-dropdown id="texture"></texture-dropdown></div>
`;

export default class MaterialEditorComponent extends HTMLElement {
    private _material: IMaterial;
    private colorElement: ColorEditorComponent;
    private lumenElement: HTMLInputElement;
    private lumenDisplay: HTMLSpanElement;
    private textureElement: TextureDropdownComponent;
    private _sources: ITextureSource[];

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});
        shadowRoot.appendChild(template.content.cloneNode(true));

        this.colorElement = <ColorEditorComponent>shadowRoot.querySelector('#color');
        this.lumenElement = <HTMLInputElement>shadowRoot.querySelector('#lumen');
        this.lumenDisplay = <HTMLSpanElement>shadowRoot.querySelector('#lumen-display');
        this.textureElement = <TextureDropdownComponent>shadowRoot.querySelector('#texture');

        this.colorElement.addEventListener('change', this.onMaterialChanged);
        this.lumenElement.addEventListener('input', this.onLumenInput);
        this.textureElement.addEventListener('change', this.onMaterialChanged);
    }

    private onLumenInput = (event: Event) => {
        this.lumenDisplay.textContent = (+this.lumenElement.value).toFixed(2);
        this.onMaterialChanged(event);
    };

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
        const lumenValue = this._material?.luminosity ?? 0;
        this.lumenElement.value = lumenValue.toString();
        this.lumenDisplay.textContent = lumenValue.toFixed(2);
        this.textureElement.value = this._material?.texture;
    }
}

window.customElements.define('material-editor', MaterialEditorComponent);
