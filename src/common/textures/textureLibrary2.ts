import { IMaterial } from '../geometry/properties';
import { connect } from '../store/store-connector';
import { ITextureReference, ITextureSource } from "./model";
import { Texture2 } from './texture2';


export class TextureLibrary2 {
    private _sources: ITextureSource[] = [];
    private _textures: Texture2[] = [];

    public get textures() { return this._sources; }

    constructor() {        
        connect(state => {
            if (this._sources !== state.textures.sources) {
                this._sources = state.textures.sources;
                this._textures = this._sources.map(s => new Texture2(s));
            }            
        })        
    }

    public previous = (ref: ITextureReference): ITextureReference => {
        const t = this._textures.findIndex(_ => _.id === ref.id);
        if (ref.index <= 0) {
            const texture = (this._textures[t+1] || this._textures[0]);
            return ({id: texture.id, index: texture.parts-1});
        } else {
            return ({...ref, index: ref.index-1});
        }
    }

    public next = (ref: ITextureReference): ITextureReference => {
        const t = this._textures.findIndex(_ => _.id === ref.id);
        if (ref.index >= this._textures[t].parts-1) {
            const texture = (this._textures[t+1] || this._textures[0]);
            return ({id: texture.id, index: 0});
        } else {
            return ({...ref, index: ref.index+1});
        }
    }
    
    public getTexture = (material: IMaterial): Texture2|null => {        
        if (!material?.texture) { return null; }
        const id = material.texture.id;
        return this._textures.find(_ => _.id === id);
    }
}
export const textureLib = new TextureLibrary2();