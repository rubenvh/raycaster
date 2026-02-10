export interface ITextureSource {
    path?: string;
    /** Raw base64-encoded image data (without data URL prefix) */
    data?: string;
    /** MIME type of the image (e.g., 'image/png', 'image/jpeg') */
    mimeType?: string;
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
