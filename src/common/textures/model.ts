export interface ITextureSource {
    path?: string;
    data?: string;
    id?: string;
    textureWidth: number;
    textureHeight: number;    
    totalWidth?: number;
    totalHeight?: number;
}
export interface ITextureReference {
    id: string,
    index: number,
}
