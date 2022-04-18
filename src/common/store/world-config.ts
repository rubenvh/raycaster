import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Slice
export type IWorldConfigState = {fadeOn?: number, horizonDistance?: number};
const slice = createSlice({
  name: 'worldConfig',
  initialState: {      
      fadeOn: undefined,  
      horizonDistance: 300
  } as IWorldConfigState,
  reducers: {    
    initialize: (_, action: PayloadAction<IWorldConfigState>) => action.payload,
    toggleFadingStrategy: (state) => {
        if (state.fadeOn == null) {
            state.fadeOn = 0;
        } else if (state.fadeOn <= 245) {
            state.fadeOn += 10;
        } else {
            state.fadeOn = null;
        }
    }
  },
});
export default slice.reducer
// Actions
export const { initialize, toggleFadingStrategy } = slice.actions