import { ITextureReference } from './../textures/model';

export type Color = [number, number, number, number];
export type IMaterial = {color: Color, texture?: ITextureReference, luminosity?: number};

export const cloneMaterial = (m: IMaterial): IMaterial => m == null ? null : ({
    color: [...m.color], 
    texture: m.texture != null ? {id: m.texture.id, index: m.texture.index} : null,
    luminosity: m.luminosity});