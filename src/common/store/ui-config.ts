import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Slice
export type IUIConfigState = {enableTestCanvas?: boolean};
const slice = createSlice({
  name: 'uiConfig',
  initialState: {      
    enableTestCanvas: undefined,  
  } as IUIConfigState,
  reducers: {    
    initialize: (_, action: PayloadAction<IUIConfigState>) => action.payload,
    toggleTestCanvas: (state) => {
        state.enableTestCanvas = !state.enableTestCanvas;        
    }
  },
});
export default slice.reducer
// Actions
export const { initialize, toggleTestCanvas } = slice.actions