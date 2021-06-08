import { Texture } from '../../common/textures/texture';
import { ITextureSource, ITextureReference } from './../../common/textures/model';
import { textureLib } from './../../common/textures/textureLibrary';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
#images {
    display: flex;
    flex-direction: column; 
    height: 256px;
    width: 85px;
    overflow-y: scroll;
    cursor: pointer;      
    padding-left: 5px; 
}
.selected {
    background-color: red;
}
</style>
<div id="images"></div>
`;
/// …

export default class TextureSelectorComponent extends HTMLElement {
       
    
    private _sources: ITextureSource[] = [];

    private imagesElement: HTMLElement;
    private _value: ITextureReference;

    constructor() {
        super();        
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));

        this.imagesElement = shadowRoot.querySelector('#images');
        
    }

    set textures (textures: ITextureSource[]) {
        if (this._sources !== textures) {
            this._sources = textures;    
            this.render();
        }
    }

    get value(): ITextureReference {
        return this._value;
    }
    set value(ref: ITextureReference) {
        this._value = ref;
        this.imagesElement.children
        // TODO: select img for reference
    }
    

    private render() {           
        
        
        const imgs = this._sources
        .reduce((acc, t) => acc.concat(textureLib.getTextureReferences(t.id).map(r => ({textureFile: textureLib.getTexture(t.id), texture: r}))), [] as {textureFile: Texture, texture: ITextureReference}[])
        .map(_ => {
            const img = document.createElement("img");
            img.src = _.textureFile.getTextureAsImage(_.texture);            
            img.setAttribute('data-id', JSON.stringify(_.texture));
            img.width = img.height = 64;
            img.addEventListener('click', (e) => {
                e.stopPropagation();   
                this._value = _.texture;
                this.dispatchEvent(new Event('change'));//, { detail: _.texture, bubbles: true, composed: true }));
            });
            return img;
        });

        imgs[0].classList.add('selected');

        this.imagesElement.innerHTML = '';
        this.imagesElement.append(...imgs); 
               
    }    
}

window.customElements.define('texture-selector', TextureSelectorComponent);