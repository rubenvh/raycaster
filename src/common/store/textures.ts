import { ITextureSource } from './../textures/model';
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import sizeOf from 'image-size';       

// Slice
export type ITextureLibraryState = {sources: ITextureSource[]};
const slice = createSlice({
  name: 'textures',
  initialState: {sources: [] } as ITextureLibraryState,
  reducers: {    
    initialize: (state, action: PayloadAction<ITextureSource[]>) => {      
      state.sources = action.payload;
    },
    loadTexture: (_, action: PayloadAction<{buffer:Buffer, path: string, fileName: string}>) => {
      const {path, buffer, fileName} = action.payload;
      const base64 = Buffer.from(buffer).toString('base64');
      const dimensions = sizeOf(path);
      // TODO: get filename and use as id
      var s: ITextureSource = {id: fileName, textureHeight: 0, textureWidth: 0, data: base64, totalHeight: dimensions.height, totalWidth: dimensions.width};
      _.sources.push(s);      
    },
    adaptTexture: (state, action: PayloadAction<{id: string, textureHeight: number, textureWidth: number}>) => {
      const {id, textureHeight, textureWidth} = action.payload;
      const s = state.sources.find(_=>_.id === id);
      s.textureHeight = textureHeight;
      s.textureWidth = textureWidth;
    }
  },
});
export default slice.reducer

// Actions
export const { initialize, loadTexture, adaptTexture } = slice.actions