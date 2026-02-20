import { ITextureSource } from './../textures/model';
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Slice
export type ITextureLibraryState = {sources: ITextureSource[]};
const slice = createSlice({
  name: 'textures',
  initialState: {sources: [] } as ITextureLibraryState,
  reducers: {    
    initialize: (state, action: PayloadAction<ITextureSource[]>) => {      
      state.sources = action.payload;
    },
    loadTexture: (state, action: PayloadAction<{
      buffer: ArrayBuffer | Uint8Array, 
      fileName: string,
      width: number,
      height: number
    }>) => {
      const {buffer, fileName, width, height} = action.payload;
      // Convert buffer to base64 - use chunk approach to avoid O(n^2) string concatenation
      const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      // Process in chunks to avoid call stack limits with String.fromCharCode.apply
      const CHUNK_SIZE = 8192;
      const chunks: string[] = [];
      for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
        const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
        chunks.push(String.fromCharCode.apply(null, chunk as any));
      }
      const base64 = btoa(chunks.join(''));
      // Determine MIME type from file extension
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeType = extension === 'jpg' || extension === 'jpeg' 
        ? 'image/jpeg' 
        : extension === 'gif' 
          ? 'image/gif' 
          : 'image/png';
      const s: ITextureSource = {
        id: fileName, 
        textureHeight: 0, 
        textureWidth: 0, 
        data: base64,
        mimeType,
        totalHeight: height, 
        totalWidth: width
      };
      state.sources.push(s);      
    },
    adaptTexture: (state, action: PayloadAction<{id: string, textureHeight: number, textureWidth: number}>) => {
      const {id, textureHeight, textureWidth} = action.payload;
      const s = state.sources.find(_=>_.id === id);
      if (s) {
        s.textureHeight = textureHeight;
        s.textureWidth = textureWidth;
      }
    }
  },
});
export default slice.reducer

// Actions
export const { initialize, loadTexture, adaptTexture } = slice.actions
