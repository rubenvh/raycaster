import { ITextureReference } from './../textures/model';
import { Guid } from "guid-typescript";

export type Color = [number, number, number, number];
export type IMaterial = {color: Color, texture?: Guid|ITextureReference, luminosity?: number};

export const cloneMaterial = (m: IMaterial): IMaterial => m == null ? null : ({
    color: [...m.color], 
    texture: m.texture != null && 'id' in m.texture ? {id: m.texture.id, index: m.texture.index} : null,
    luminosity: m.luminosity});