import { ITextureReference } from './../textures/model';

export type Color = [number, number, number, number];
export enum Face {
    interior = 0,
    exterior = 1
};
export type IDirectedMaterial = IMaterial | [IMaterial, IMaterial];
export type IMaterial = {color: Color, texture?: ITextureReference, luminosity?: number};

export const cloneMaterial = (m: IDirectedMaterial): IDirectedMaterial => 
    m == null ? null :
    Array.isArray(m) ? [cloneSingleMaterial(m[Face.interior]), cloneSingleMaterial(m[Face.exterior])]: 
    cloneSingleMaterial(m);

const cloneSingleMaterial = (m: IMaterial): IMaterial => m == null ? null : ({
    color: [...m.color], 
    texture: m.texture != null ? {id: m.texture.id, index: m.texture.index} : null,
    luminosity: m.luminosity});

export const isTranslucent = (face: Face, m: IDirectedMaterial): boolean => 
    getMaterial(face, m)?.color[3] < 1;
export const getMaterial = (face: Face, m: IDirectedMaterial): IMaterial =>  
    m == null ? null : Array.isArray(m) ? m[face] : m;

export const applyTexture = (face: Face, m: IDirectedMaterial, t: ITextureReference,
    applier: (m: IMaterial, t: ITextureReference) => IMaterial): IDirectedMaterial => {
        if (Array.isArray(m)) {                
            m[face] = applier(m[face], t);
            return m;
        }
        else if (face === Face.interior) {
            return applier(m, t);
        }
        else {
            return [m, applier(cloneSingleMaterial(m), t)];
        }
    }

export const toggleTexture = (m: IMaterial, t: ITextureReference): IMaterial => {
    m.texture = !m.texture ? t : null;
    return m;
}
export const setTexture = (m: IMaterial, t: ITextureReference): IMaterial => {
    m.texture = t;
    return m;
}

