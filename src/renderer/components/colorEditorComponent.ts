import { Color } from '../../common/geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: inline-flex;
    align-items: center;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
    gap: 4px;
}
#tile {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 1px solid #555;
    border-radius: 2px;
    vertical-align: middle;
    flex-shrink: 0;
}
.channel-label {
    color: #aaa;
    font-size: 10px;
}
input[type="number"] {
    background: #333;
    border: 1px solid #555;
    color: #eee;
    font-family: monospace;
    font-size: 11px;
    padding: 1px 2px;
    width: 3.5em;
    border-radius: 2px;
}
input[type="number"]:focus {
    outline: none;
    border-color: #42a5f5;
}
</style>
<span id="tile">&nbsp;</span>
<span class="channel-label">R</span><input id="red" type="number" min="0" max="255" name="red" />
<span class="channel-label">G</span><input id="green" type="number" min="0" max="255" name="green" />
<span class="channel-label">B</span><input id="blue" type="number" min="0" max="255" name="blue" />
<span class="channel-label">A</span><input id="alpha" type="number" min="0" max="1" step="0.1" name="alpha" />
`;


export default class ColorEditorComponent extends HTMLElement {
    private _color: Color = [0,0,0,0];
    private tileElement: HTMLSpanElement;
    private redElement: HTMLInputElement;
    private greenElement: HTMLInputElement;
    private blueElement: HTMLInputElement;
    private alphaElement: HTMLInputElement;
    
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        

        this.tileElement = <HTMLSpanElement>shadowRoot.querySelector('#tile');        
        this.redElement = <HTMLInputElement>shadowRoot.querySelector('#red');
        this.greenElement = <HTMLInputElement>shadowRoot.querySelector('#green');        
        this.blueElement = <HTMLInputElement>shadowRoot.querySelector('#blue');
        this.alphaElement = <HTMLInputElement>shadowRoot.querySelector('#alpha');        

        this.redElement.addEventListener('change', this.eventHandler);
        this.greenElement.addEventListener('change', this.eventHandler);
        this.blueElement.addEventListener('change', this.eventHandler);
        this.alphaElement.addEventListener('change', this.eventHandler);
    } 

    private eventHandler = (_: Event) => {   
        this._color = this.color;     
        this.dispatchEvent(new CustomEvent('change', { detail: this.color, bubbles: true, composed: true }));
    };
   
    private render() {                
        const [r, g, b, a] = this._color;
        this.redElement.value = r.toString();
        this.greenElement.value = g.toString();
        this.blueElement.value = b.toString();
        this.alphaElement.value = a.toString();
        this.tileElement.style.backgroundColor = `rgb(${r},${g},${b})`;
    }

    set color(c: Color) {
        if (this._color !== c) {
            this._color = c;
            this.render();
        }
    }
    get color(): Color {
        return [
            +this.redElement.value,
            +this.greenElement.value,
            +this.blueElement.value,
            +this.alphaElement.value,
        ];
    }
}

window.customElements.define('color-editor', ColorEditorComponent);