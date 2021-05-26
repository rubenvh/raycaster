import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Slice
export type IUIConfigState = {enableTestCanvas?: boolean, drawBsp?: boolean};
const slice = createSlice({
  name: 'uiConfig',
  initialState: {      
    enableTestCanvas: undefined,  
    drawBsp: undefined
  } as IUIConfigState,
  reducers: {    
    initialize: (_, action: PayloadAction<IUIConfigState>) => action.payload,
    toggleTestCanvas: (state) => {
        state.enableTestCanvas = !state.enableTestCanvas;        
    },
    toggleBspDrawing: (state) => {
      state.drawBsp = !state.drawBsp;        
  }
  },
});
export default slice.reducer
// Actions
export const { initialize, toggleTestCanvas, toggleBspDrawing } = slice.actions