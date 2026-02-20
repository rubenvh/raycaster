import { IMaterial } from '../geometry/properties';
import { connect } from '../store/store-connector';
import { ITextureReference, ITextureSource } from "./model";
import { Texture } from './texture';


export class TextureLibrary {
    private _sources: ITextureSource[] = [];
    private _textures: Texture[] = [];
    // Map from texture source id to Texture instance for efficient diffing
    private _textureMap: Map<string, Texture> = new Map();

    public get textures() { return this._sources; }

    constructor() {        
        connect(state => {
            if (this._sources !== state.textures.sources) {
                const newSources = state.textures.sources;
                // Diff: only create Texture instances for new/changed sources
                const newMap = new Map<string, Texture>();
                for (const source of newSources) {
                    const existing = this._textureMap.get(source.id);
                    if (existing) {
                        // Reuse existing texture if source hasn't changed
                        newMap.set(source.id, existing);
                    } else {
                        // New texture source — create Texture instance
                        const t = new Texture(source);
                        newMap.set(source.id, t);
                    }
                }
                this._sources = newSources;
                this._textureMap = newMap;
                this._textures = newSources.map(s => newMap.get(s.id)!);
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
    
public lookupTexture = (material: IMaterial): Texture|null => {        
        if (!material?.texture) { return null; }
        const id = material.texture.id;
        return this.getTexture(id);
    }

    public getTexture = (id: string): Texture|null => this._textures.find(_ => _.id === id);
    public getTextureReferences = (id: string): ITextureReference[] => {
        const t = this.getTexture(id);
        return new Array(t?.parts || 0).fill(0).map((_, index) => ({id, index}));
    }

    /** Wait for all textures to finish loading their images */
    public waitForLoad = (): Promise<void[]> => Promise.all(this._textures.map(t => t.loaded));
}
export const textureLib = new TextureLibrary();