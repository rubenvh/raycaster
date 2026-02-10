import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// BSP drawing mode enum
export enum BspDrawMode {
  None = 0,           // Geometry only
  Planes = 1,         // BSP partition planes
  DetectedEdges = 2   // BSP detected edges
}

// Slice
export type IUIConfigState = {enableTestCanvas?: boolean, bspDrawMode?: BspDrawMode};
const slice = createSlice({
  name: 'uiConfig',
  initialState: {      
    enableTestCanvas: undefined,  
    bspDrawMode: BspDrawMode.None
  } as IUIConfigState,
  reducers: {    
    initialize: (_, action: PayloadAction<IUIConfigState>) => action.payload,
    toggleTestCanvas: (state) => {
        state.enableTestCanvas = !state.enableTestCanvas;        
    },
    cycleBspDrawMode: (state) => {
      state.bspDrawMode = ((state.bspDrawMode || 0) + 1) % 3;        
    }
  },
});
export default slice.reducer
// Actions
export const { initialize, toggleTestCanvas, cycleBspDrawMode } = slice.actions
