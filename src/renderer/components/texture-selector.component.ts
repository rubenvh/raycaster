import { Texture } from '../../common/textures/texture';
import { ITextureSource, ITextureReference } from '../../common/textures/model';
import { textureLib } from '../../common/textures/textureLibrary';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
#images::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.9);
}
#images::-webkit-scrollbar {
    width: 5px;
}
#images::-webkit-scrollbar-thumb {
    background: rgba(125, 125, 125, 0.7);
}
#images::-webkit-scrollbar-thumb:hover {
    background: rgba(125, 125, 125, 1);
}
#images {
    display: flex;
    flex-flow: row wrap;
    max-height: 264px;
    overflow-y: auto;
    align-content: flex-start;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 2px;
}
.image {
    cursor: pointer;
    padding: 2px;
    height: 64px;
    width: 64px;
    border-radius: 2px;
    opacity: 0.85;
    transition: opacity 0.1s;
}
.image:hover {
    opacity: 1;
}
.selected {
    background-color: #42a5f5;
    opacity: 1;
}
</style>
<div id="images"></div>
`;

export default class TextureSelectorComponent extends HTMLElement {

    private _sources: ITextureSource[] = [];
    private imagesElement: HTMLElement;
    private _value: ITextureReference;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRoot.appendChild(template.content.cloneNode(true));
        this.imagesElement = shadowRoot.querySelector('#images');
    }

    set textures(textures: ITextureSource[]) {
        if (this._sources !== textures) {
            this._sources = textures;
            this._value = this._sources.length > 0 ? { id: this._sources[0].id, index: 0 } : undefined;
            this.render();
        }
    }

    get value(): ITextureReference {
        return this._value;
    }    
    set value(ref: ITextureReference) {
        if (ref !== this._value) {
            this._value = ref;
            this.selectImage();
            this.render();
        }        
    }

    private selectImage = () => {
        let images = Array.from(this.imagesElement.children);
        images.forEach(i => {
            const r = { id: i.getAttribute('data-id'), index: +i.getAttribute('data-index') };
            if (r.id === this._value?.id && r.index === this._value.index) {
                i.classList.add('selected');
            } else {
                i.classList.remove('selected');
            }
        });
    }

    private async render() {
        // Wait for all textures to load before rendering
        const loadPromises = this._sources
            .map(s => textureLib.getTexture(s.id)?.loaded)
            .filter((p): p is Promise<void> => p != null);
        await Promise.all(loadPromises);

        const imgs = this._sources
            .reduce((acc, t) => acc.concat(textureLib.getTextureReferences(t.id).map(r => ({ textureFile: textureLib.getTexture(t.id), texture: r }))), [] as { textureFile: Texture, texture: ITextureReference }[])
            .map(_ => {
                const img = document.createElement("img");
                img.src = _.textureFile.getTextureAsImage(_.texture);
                img.setAttribute('data-id', _.texture.id);
                img.setAttribute('data-index', _.texture.index.toString());
                img.classList.add('image');
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.value = _.texture;
                    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                });
                return img;
            });

        this.imagesElement.innerHTML = '';
        this.imagesElement.append(...imgs);
        this.selectImage();
    }
}

window.customElements.define('texture-selector', TextureSelectorComponent);