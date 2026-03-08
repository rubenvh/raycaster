import { Color } from '../../common/geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
}
.color-row {
    display: flex;
    align-items: center;
    gap: 6px;
}
input[type="color"] {
    -webkit-appearance: none;
    appearance: none;
    border: 1px solid #555;
    border-radius: 3px;
    width: 32px;
    height: 22px;
    padding: 0;
    cursor: pointer;
    background: transparent;
    flex-shrink: 0;
}
input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 1px;
}
input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
}
input[type="color"]:focus {
    outline: none;
    border-color: #42a5f5;
}
.hex-value {
    color: #999;
    font-size: 10px;
    min-width: 5em;
}
.alpha-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 3px;
}
.alpha-label {
    color: #aaa;
    font-size: 10px;
    min-width: 2.5em;
}
input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, transparent, var(--track-color, #fff));
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
.alpha-value {
    color: #eee;
    font-size: 10px;
    min-width: 2.5em;
    text-align: right;
}
.checkerboard {
    display: inline-block;
    width: 32px;
    height: 22px;
    border: 1px solid #555;
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
    background-image:
        linear-gradient(45deg, #444 25%, transparent 25%),
        linear-gradient(-45deg, #444 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #444 75%),
        linear-gradient(-45deg, transparent 75%, #444 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}
.checkerboard-inner {
    width: 100%;
    height: 100%;
    border-radius: 2px;
}
</style>
<div class="color-row">
    <input id="picker" type="color" />
    <span id="preview" class="checkerboard"><span id="preview-inner" class="checkerboard-inner"></span></span>
    <span id="hex" class="hex-value"></span>
</div>
<div class="alpha-row">
    <span class="alpha-label">alpha</span>
    <input id="alpha" type="range" min="0" max="1" step="0.05" />
    <span id="alpha-display" class="alpha-value"></span>
</div>
`;

function toHex(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function colorToHex(r: number, g: number, b: number): string {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

export default class ColorEditorComponent extends HTMLElement {
    private _color: Color = [0,0,0,0];
    private pickerElement: HTMLInputElement;
    private alphaElement: HTMLInputElement;
    private alphaDisplay: HTMLSpanElement;
    private hexDisplay: HTMLSpanElement;
    private previewInner: HTMLSpanElement;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});
        shadowRoot.appendChild(template.content.cloneNode(true));

        this.pickerElement = <HTMLInputElement>shadowRoot.querySelector('#picker');
        this.alphaElement = <HTMLInputElement>shadowRoot.querySelector('#alpha');
        this.alphaDisplay = <HTMLSpanElement>shadowRoot.querySelector('#alpha-display');
        this.hexDisplay = <HTMLSpanElement>shadowRoot.querySelector('#hex');
        this.previewInner = <HTMLSpanElement>shadowRoot.querySelector('#preview-inner');

        this.pickerElement.addEventListener('input', this.eventHandler);
        this.alphaElement.addEventListener('input', this.eventHandler);
    }

    private eventHandler = (_: Event) => {
        this._color = this.color;
        this.updatePreview();
        this.dispatchEvent(new CustomEvent('change', { detail: this.color, bubbles: true, composed: true }));
    };

    private updatePreview() {
        const [r, g, b, a] = this._color;
        const hex = colorToHex(r, g, b);
        this.hexDisplay.textContent = hex;
        this.alphaDisplay.textContent = a.toFixed(2);
        this.previewInner.style.backgroundColor = `rgba(${r},${g},${b},${a})`;
        this.alphaElement.style.setProperty('--track-color', `rgb(${r},${g},${b})`);
    }

    private render() {
        const [r, g, b, a] = this._color;
        this.pickerElement.value = colorToHex(r, g, b);
        this.alphaElement.value = a.toString();
        this.updatePreview();
    }

    set color(c: Color) {
        if (this._color !== c) {
            this._color = c;
            this.render();
        }
    }
    get color(): Color {
        const [r, g, b] = hexToRgb(this.pickerElement.value);
        return [r, g, b, +this.alphaElement.value];
    }
}

window.customElements.define('color-editor', ColorEditorComponent);
