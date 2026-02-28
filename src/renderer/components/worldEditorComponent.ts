import { useAppDispatch } from '../../common/store';
import { connect } from '../../common/store/store-connector';
import { 
    IWorldConfigState, RGBColor, DEFAULT_SKY_COLOR, DEFAULT_FLOOR_COLOR,
    setSkyColor, setFloorColor, setFadeOn, setHorizonDistance, toggleSkyboxEnabled, setSkybox 
} from '../../common/store/world-config';

const dispatch = useAppDispatch();

const template = document.createElement('template');
template.innerHTML = /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
}
:host([hidden]) { display: none; }
section {
    margin-bottom: 8px;
    padding: 4px 0;
    border-bottom: 1px solid #333;
}
section:last-child { border-bottom: none; }
h4 {
    margin: 0 0 4px 0;
    font-size: 11px;
    color: #eee;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
label {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 2px 0;
    cursor: pointer;
}
.row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 3px 0;
}
.color-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 3px 0;
}
.color-row .channel-label {
    color: #aaa;
    font-size: 10px;
    min-width: 8px;
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
input[type="range"] {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #444;
    border-radius: 2px;
    outline: none;
}
input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #42a5f5;
    cursor: pointer;
}
input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
}
input[type="color"] {
    width: 24px;
    height: 20px;
    padding: 0;
    border: 1px solid #555;
    border-radius: 2px;
    cursor: pointer;
    background: #333;
}
.value-label {
    color: #aaa;
    min-width: 28px;
    text-align: right;
    font-size: 10px;
}
.skybox-preview {
    width: 100%;
    max-height: 40px;
    object-fit: cover;
    border: 1px solid #555;
    border-radius: 2px;
    margin: 4px 0;
}
.skybox-info {
    color: #888;
    font-size: 10px;
}
.skybox-controls {
    margin-top: 4px;
}
select {
    background: #333;
    border: 1px solid #555;
    color: #eee;
    font-family: monospace;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 2px;
    flex: 1;
    max-width: 150px;
}
select:focus {
    outline: none;
    border-color: #42a5f5;
}
button {
    background: #444;
    border: 1px solid #555;
    color: #eee;
    font-family: monospace;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 2px;
    cursor: pointer;
}
button:hover { background: #555; }
.hidden { display: none; }
.color-tile {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 1px solid #555;
    border-radius: 2px;
    flex-shrink: 0;
}
</style>

<section id="skybox-section">
    <h4>Skybox</h4>
    <label>
        <input type="checkbox" id="skybox-enabled" />
        Enable Skybox
    </label>
    <div id="skybox-details" class="skybox-controls">
        <div class="row">
            <select id="skybox-select">
                <option value="">-- none --</option>
            </select>
            <button id="skybox-import">Import...</button>
        </div>
        <img id="skybox-preview" class="skybox-preview hidden" />
        <div id="skybox-info" class="skybox-info"></div>
    </div>
</section>

<section id="colors-section">
    <h4>Sky Color</h4>
    <div class="color-row">
        <span class="color-tile" id="sky-tile"></span>
        <input type="color" id="sky-picker" />
        <span class="channel-label">R</span><input type="number" id="sky-r" min="0" max="255" />
        <span class="channel-label">G</span><input type="number" id="sky-g" min="0" max="255" />
        <span class="channel-label">B</span><input type="number" id="sky-b" min="0" max="255" />
    </div>
    <h4>Floor Color</h4>
    <div class="color-row">
        <span class="color-tile" id="floor-tile"></span>
        <input type="color" id="floor-picker" />
        <span class="channel-label">R</span><input type="number" id="floor-r" min="0" max="255" />
        <span class="channel-label">G</span><input type="number" id="floor-g" min="0" max="255" />
        <span class="channel-label">B</span><input type="number" id="floor-b" min="0" max="255" />
    </div>
</section>

<section id="fading-section">
    <h4>Fading</h4>
    <label>
        <input type="checkbox" id="fade-enabled" />
        Enable Fading
    </label>
    <div id="fade-details">
        <div class="row">
            <span>Shade</span>
            <input type="range" id="fade-shade" min="0" max="255" />
            <span class="value-label" id="fade-shade-value">0</span>
        </div>
        <div class="row">
            <span>Distance</span>
            <input type="range" id="fade-distance" min="50" max="1000" step="10" />
            <span class="value-label" id="fade-distance-value">300</span>
        </div>
    </div>
</section>
`;

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): RGBColor {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [0, 0, 0];
}

export default class WorldEditorComponent extends HTMLElement {
    private _config: IWorldConfigState = {};
    private _bundledSkyboxes: string[] = [];

    // Skybox elements
    private skyboxEnabled: HTMLInputElement;
    private skyboxSelect: HTMLSelectElement;
    private skyboxImport: HTMLButtonElement;
    private skyboxPreview: HTMLImageElement;
    private skyboxInfo: HTMLElement;
    private skyboxDetails: HTMLElement;

    // Color elements
    private colorsSection: HTMLElement;
    private skyPicker: HTMLInputElement;
    private skyTile: HTMLElement;
    private skyR: HTMLInputElement;
    private skyG: HTMLInputElement;
    private skyB: HTMLInputElement;
    private floorPicker: HTMLInputElement;
    private floorTile: HTMLElement;
    private floorR: HTMLInputElement;
    private floorG: HTMLInputElement;
    private floorB: HTMLInputElement;

    // Fading elements
    private fadeEnabled: HTMLInputElement;
    private fadeDetails: HTMLElement;
    private fadeShade: HTMLInputElement;
    private fadeShadeValue: HTMLElement;
    private fadeDistance: HTMLInputElement;
    private fadeDistanceValue: HTMLElement;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});
        shadowRoot.appendChild(template.content.cloneNode(true));

        // Query skybox elements
        this.skyboxEnabled = shadowRoot.getElementById('skybox-enabled') as HTMLInputElement;
        this.skyboxSelect = shadowRoot.getElementById('skybox-select') as HTMLSelectElement;
        this.skyboxImport = shadowRoot.getElementById('skybox-import') as HTMLButtonElement;
        this.skyboxPreview = shadowRoot.getElementById('skybox-preview') as HTMLImageElement;
        this.skyboxInfo = shadowRoot.getElementById('skybox-info') as HTMLElement;
        this.skyboxDetails = shadowRoot.getElementById('skybox-details') as HTMLElement;

        // Query color elements
        this.colorsSection = shadowRoot.getElementById('colors-section') as HTMLElement;
        this.skyPicker = shadowRoot.getElementById('sky-picker') as HTMLInputElement;
        this.skyTile = shadowRoot.getElementById('sky-tile') as HTMLElement;
        this.skyR = shadowRoot.getElementById('sky-r') as HTMLInputElement;
        this.skyG = shadowRoot.getElementById('sky-g') as HTMLInputElement;
        this.skyB = shadowRoot.getElementById('sky-b') as HTMLInputElement;
        this.floorPicker = shadowRoot.getElementById('floor-picker') as HTMLInputElement;
        this.floorTile = shadowRoot.getElementById('floor-tile') as HTMLElement;
        this.floorR = shadowRoot.getElementById('floor-r') as HTMLInputElement;
        this.floorG = shadowRoot.getElementById('floor-g') as HTMLInputElement;
        this.floorB = shadowRoot.getElementById('floor-b') as HTMLInputElement;

        // Query fading elements
        this.fadeEnabled = shadowRoot.getElementById('fade-enabled') as HTMLInputElement;
        this.fadeDetails = shadowRoot.getElementById('fade-details') as HTMLElement;
        this.fadeShade = shadowRoot.getElementById('fade-shade') as HTMLInputElement;
        this.fadeShadeValue = shadowRoot.getElementById('fade-shade-value') as HTMLElement;
        this.fadeDistance = shadowRoot.getElementById('fade-distance') as HTMLInputElement;
        this.fadeDistanceValue = shadowRoot.getElementById('fade-distance-value') as HTMLElement;

        // --- Event handlers ---

        // Skybox toggle
        this.skyboxEnabled.addEventListener('change', () => {
            dispatch(toggleSkyboxEnabled());
        });

        // Skybox dropdown selection
        this.skyboxSelect.addEventListener('change', () => {
            const value = this.skyboxSelect.value;
            if (value === '') {
                dispatch(setSkybox(null));
            } else if (value === '__current__') {
                // Already loaded, do nothing
            } else {
                // Load a bundled skybox via IPC
                this.loadBundledSkybox(value);
            }
        });

        // Import button triggers the existing skybox import dialog via IPC
        this.skyboxImport.addEventListener('click', () => {
            window.electronAPI.send('importSkybox-request');
        });

        // Sky color inputs
        const skyColorHandler = () => {
            const rgb: RGBColor = [+this.skyR.value, +this.skyG.value, +this.skyB.value];
            this.skyPicker.value = rgbToHex(...rgb);
            this.skyTile.style.backgroundColor = `rgb(${rgb.join(',')})`;
            dispatch(setSkyColor(rgb));
        };
        this.skyR.addEventListener('change', skyColorHandler);
        this.skyG.addEventListener('change', skyColorHandler);
        this.skyB.addEventListener('change', skyColorHandler);
        this.skyPicker.addEventListener('input', () => {
            const rgb = hexToRgb(this.skyPicker.value);
            this.skyR.value = rgb[0].toString();
            this.skyG.value = rgb[1].toString();
            this.skyB.value = rgb[2].toString();
            this.skyTile.style.backgroundColor = `rgb(${rgb.join(',')})`;
            dispatch(setSkyColor(rgb));
        });

        // Floor color inputs
        const floorColorHandler = () => {
            const rgb: RGBColor = [+this.floorR.value, +this.floorG.value, +this.floorB.value];
            this.floorPicker.value = rgbToHex(...rgb);
            this.floorTile.style.backgroundColor = `rgb(${rgb.join(',')})`;
            dispatch(setFloorColor(rgb));
        };
        this.floorR.addEventListener('change', floorColorHandler);
        this.floorG.addEventListener('change', floorColorHandler);
        this.floorB.addEventListener('change', floorColorHandler);
        this.floorPicker.addEventListener('input', () => {
            const rgb = hexToRgb(this.floorPicker.value);
            this.floorR.value = rgb[0].toString();
            this.floorG.value = rgb[1].toString();
            this.floorB.value = rgb[2].toString();
            this.floorTile.style.backgroundColor = `rgb(${rgb.join(',')})`;
            dispatch(setFloorColor(rgb));
        });

        // Fade toggle
        this.fadeEnabled.addEventListener('change', () => {
            if (this.fadeEnabled.checked) {
                dispatch(setFadeOn(+this.fadeShade.value));
            } else {
                dispatch(setFadeOn(null));
            }
        });

        // Fade shade slider
        this.fadeShade.addEventListener('input', () => {
            this.fadeShadeValue.textContent = this.fadeShade.value;
            dispatch(setFadeOn(+this.fadeShade.value));
        });

        // Fade distance slider
        this.fadeDistance.addEventListener('input', () => {
            this.fadeDistanceValue.textContent = this.fadeDistance.value;
            dispatch(setHorizonDistance(+this.fadeDistance.value));
        });

        // Subscribe to store
        connect(state => {
            if (this._config !== state.worldConfig) {
                this._config = state.worldConfig;
                this.render();
            }
        });

        // Load bundled skybox list
        this.loadSkyboxList();
    }

    private render() {
        const config = this._config;

        // Skybox section
        const skyboxOn = !!config.skyboxEnabled;
        this.skyboxEnabled.checked = skyboxOn;
        this.skyboxDetails.classList.toggle('hidden', !skyboxOn);

        if (config.skybox) {
            this.skyboxPreview.src = `data:${config.skybox.mimeType};base64,${config.skybox.data}`;
            this.skyboxPreview.classList.remove('hidden');
            this.skyboxInfo.textContent = `${config.skybox.id} (${config.skybox.width}x${config.skybox.height})`;
            // Select the current skybox in dropdown if it matches a bundled one
            const matchOption = Array.from(this.skyboxSelect.options).find(o => o.value === config.skybox.id);
            if (matchOption) {
                this.skyboxSelect.value = config.skybox.id;
            } else {
                // Imported skybox not in bundled list -- show as custom entry
                this.ensureCurrentOption(config.skybox.id);
                this.skyboxSelect.value = '__current__';
            }
        } else {
            this.skyboxPreview.classList.add('hidden');
            this.skyboxInfo.textContent = '';
            this.skyboxSelect.value = '';
        }

        // Colors section -- visible when skybox is off
        // (even when skybox is on, sky color is still relevant as fallback, but floor always matters)
        const skyColor = config.skyColor ?? DEFAULT_SKY_COLOR;
        const floorColor = config.floorColor ?? DEFAULT_FLOOR_COLOR;
        this.skyR.value = skyColor[0].toString();
        this.skyG.value = skyColor[1].toString();
        this.skyB.value = skyColor[2].toString();
        this.skyPicker.value = rgbToHex(...skyColor);
        this.skyTile.style.backgroundColor = `rgb(${skyColor.join(',')})`;

        this.floorR.value = floorColor[0].toString();
        this.floorG.value = floorColor[1].toString();
        this.floorB.value = floorColor[2].toString();
        this.floorPicker.value = rgbToHex(...floorColor);
        this.floorTile.style.backgroundColor = `rgb(${floorColor.join(',')})`;

        // Fading section
        const fadeOn = config.fadeOn != null;
        this.fadeEnabled.checked = fadeOn;
        this.fadeDetails.classList.toggle('hidden', !fadeOn);
        if (fadeOn) {
            this.fadeShade.value = (config.fadeOn ?? 0).toString();
            this.fadeShadeValue.textContent = (config.fadeOn ?? 0).toString();
        }
        const horizonDist = config.horizonDistance ?? 300;
        this.fadeDistance.value = horizonDist.toString();
        this.fadeDistanceValue.textContent = horizonDist.toString();
    }

    private ensureCurrentOption(name: string) {
        let opt = this.skyboxSelect.querySelector('option[value="__current__"]') as HTMLOptionElement;
        if (!opt) {
            opt = document.createElement('option');
            opt.value = '__current__';
            this.skyboxSelect.appendChild(opt);
        }
        opt.textContent = name + ' (imported)';
    }

    private async loadSkyboxList() {
        try {
            const list = await window.electronAPI.invoke('skybox:list');
            this._bundledSkyboxes = list || [];
            this.populateSkyboxDropdown();
        } catch (e) {
            // Fallback: no bundled skyboxes available
            console.warn('Could not load bundled skybox list:', e);
        }
    }

    private populateSkyboxDropdown() {
        // Keep the "-- none --" option
        const noneOpt = this.skyboxSelect.options[0];
        this.skyboxSelect.innerHTML = '';
        this.skyboxSelect.appendChild(noneOpt);

        for (const name of this._bundledSkyboxes) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            this.skyboxSelect.appendChild(opt);
        }

        // Re-render to reflect current selection
        this.render();
    }

    private async loadBundledSkybox(name: string) {
        try {
            const skyboxData = await window.electronAPI.invoke('skybox:load', name);
            if (skyboxData) {
                dispatch(setSkybox(skyboxData));
            }
        } catch (e) {
            console.error('Failed to load bundled skybox:', e);
        }
    }
}

window.customElements.define('world-editor', WorldEditorComponent);
