import { IMaterial } from './../geometry/properties';
import { ipcRenderer } from "electron";
import { ITextureReference, ITextureSource } from "./model";
import * as fs from "fs";
import { Texture } from './texture';
import { Guid } from 'guid-typescript';

export class TextureLibrary {
    private _sources: ITextureSource[];
    private _textures: Texture[];

    public get textures() { return this._sources; }

    constructor() {
        ipcRenderer.on('importTexture', (_, arg) => this.importTexture(arg.filePaths[0]));
        
        const s = localStorage.getItem('textureSources');       
        this._sources = JSON.parse(s || '[]');
        this._textures = this._sources.map(x => new Texture(x));
    }

    private importTexture = (path: string) => {    
        fs.readFile(path, (err, data) => {
            // TODO: error handling

            if (!this._sources.some(t => t.path === path)) {

                var s: ITextureSource = {path, textureHeight: 0, textureWidth: 0};
                var t = new Texture(s);
                this._sources.push(s);
                this._textures.push(t);
                localStorage.setItem('textureSources', JSON.stringify(this._sources))
            }
        });  
    };

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
    
    public getTexture = (material: IMaterial): Texture => {        
        if (!material?.texture) { return null; }
        if ('id' in material.texture) {
            const id = material.texture.id;
            return this._textures.find(_ => _.id === id);
        } else {
            return this._textures[0];
            
        }
    }
}

export const textureLib = new TextureLibrary();