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
      // Convert buffer to base64 - buffer from IPC is Uint8Array in renderer
      const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);
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
