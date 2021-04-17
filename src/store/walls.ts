import { IStoredGeometry, loadGeometry, IGeometry } from './../geometry/geometry';
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EMPTY_GEOMETRY } from '../geometry/geometry';
// Slice
export type IWallState = {geometry: IGeometry }
const slice = createSlice({
  name: 'walls',
  initialState: {      
      geometry: EMPTY_GEOMETRY,  
  } as IWallState,
  reducers: {
    loadWalls: (state, action: PayloadAction<IStoredGeometry>) => {
        state.geometry = loadGeometry(action.payload)
    },
    updateWalls: (state, action: PayloadAction<IGeometry>) => {
        state.geometry = action.payload;
    }
  },
});
export default slice.reducer
// Actions
export const { loadWalls, updateWalls } = slice.actions