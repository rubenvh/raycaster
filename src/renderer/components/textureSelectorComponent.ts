import { Texture } from '../../common/textures/texture';
import { ITextureSource, ITextureReference } from './../../common/textures/model';
import { textureLib } from './../../common/textures/textureLibrary';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
#images::-webkit-scrollbar-track
{
  border: 1px solid black;
  background-color: #555555;
}

#images::-webkit-scrollbar
{
  width: 10px;
  background-color: #555555;
}

#images::-webkit-scrollbar-thumb
{
  background-color: #000000;  
}
#images {
    z-index: 1000; 
	position: absolute;
    display: flex;
    flex-flow: row wrap;
    max-height: 264px;
    max-width: 208px;
    overflow-y: scroll;   
    align-content: flex-start 
}
.image {
    cursor: pointer;   
    padding: 1px; 
    height: 64px;
    width: 64px;
}
.selected {
    background-color: yellow;
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
            this._value = {id: this._sources[0].id, index: 0};
            this.render();
        }
    }

    get value(): ITextureReference {
        return this._value;
    }
    set value(ref: ITextureReference) {
        this._value = ref;
        this.selectImage();
            
    }
    
    private selectImage = () => {
        let images = Array.from(this.imagesElement.children);
        images.forEach(i => {
            const r = {id: i.getAttribute('data-id'), index: +i.getAttribute('data-index')};
            if (r.id === this._value.id && r.index === this._value.index) {
                i.classList.add('selected');
            }else {
                i.classList.remove('selected');
            }            
        });    
    }

    private render() {           
        
        setTimeout(() => {
            const imgs = this._sources
            .reduce((acc, t) => acc.concat(textureLib.getTextureReferences(t.id).map(r => ({textureFile: textureLib.getTexture(t.id), texture: r}))), [] as {textureFile: Texture, texture: ITextureReference}[])
            .map(_ => {
                const img = document.createElement("img");
                img.src = _.textureFile.getTextureAsImage(_.texture);            
                img.setAttribute('data-id', _.texture.id);
                img.setAttribute('data-index', _.texture.index.toString());                
                img.classList.add('image');
                img.addEventListener('click', (e) => {
                    e.stopPropagation();   
                    this.value = _.texture;
                    this.dispatchEvent(new Event('change'));//, { detail: _.texture, bubbles: true, composed: true }));
                });
                return img;
            });
                
            this.imagesElement.innerHTML = '';
            this.imagesElement.append(...imgs); 
            this.selectImage();    
        });
        
               
    }    
}

window.customElements.define('texture-selector', TextureSelectorComponent);