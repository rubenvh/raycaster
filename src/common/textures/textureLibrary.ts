import { IMaterial } from '../geometry/properties';
import { connect } from '../store/store-connector';
import { ITextureReference, ITextureSource } from "./model";
import { Texture } from './texture';


export class TextureLibrary {
    private _sources: ITextureSource[] = [];
    private _textures: Texture[] = [];

    public get textures() { return this._sources; }

    constructor() {        
        connect(state => {
            if (this._sources !== state.textures.sources) {
                this._sources = state.textures.sources;
                this._textures = this._sources.map(s => new Texture(s));
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
    
    public getTexture = (material: IMaterial): Texture|null => {        
        if (!material?.texture) { return null; }
        const id = material.texture.id;
        return this._textures.find(_ => _.id === id);
    }

    public getTextureReferences = (id: string): ITextureReference[] => {
        const t = this._textures.find(_=>_.id === id);        
        return new Array(t?.parts || 0).map((_, index) => ({id, index}));
    }
}
export const textureLib = new TextureLibrary();