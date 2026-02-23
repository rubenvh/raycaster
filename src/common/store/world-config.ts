import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ISkyboxSource } from '../skybox/model';

// Slice
export type IWorldConfigState = {
  fadeOn?: number,
  horizonDistance?: number,
  skybox?: ISkyboxSource,
  skyboxEnabled?: boolean,
};
const slice = createSlice({
  name: 'worldConfig',
  initialState: {      
      fadeOn: undefined,  
      horizonDistance: 300,
      skyboxEnabled: false
  } as IWorldConfigState,
  reducers: {    
    initialize: (_, action: PayloadAction<IWorldConfigState>) => action.payload,
    setSkybox: (state, action: PayloadAction<ISkyboxSource | null>) => {
        const source = action.payload;
        if (source) {
            state.skybox = source;
            state.skyboxEnabled = true;
        } else {
            state.skybox = undefined;
            state.skyboxEnabled = false;
        }
    },
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
export const { initialize, setSkybox, toggleFadingStrategy } = slice.actions
