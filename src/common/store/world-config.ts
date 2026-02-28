import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ISkyboxSource } from '../skybox/model';

export type RGBColor = [number, number, number];

// Slice
export type IWorldConfigState = {
  fadeOn?: number,
  horizonDistance?: number,
  skybox?: ISkyboxSource,
  skyboxEnabled?: boolean,
  skyColor?: RGBColor,
  floorColor?: RGBColor,
};

export const DEFAULT_SKY_COLOR: RGBColor = [200, 200, 200];
export const DEFAULT_FLOOR_COLOR: RGBColor = [50, 80, 80];

const slice = createSlice({
  name: 'worldConfig',
  initialState: {      
      fadeOn: undefined,  
      horizonDistance: 300,
      skyboxEnabled: false,
      skyColor: DEFAULT_SKY_COLOR,
      floorColor: DEFAULT_FLOOR_COLOR,
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
    toggleSkyboxEnabled: (state) => {
        state.skyboxEnabled = !state.skyboxEnabled;
    },
    toggleFadingStrategy: (state) => {
        if (state.fadeOn == null) {
            state.fadeOn = 0;
        } else if (state.fadeOn <= 245) {
            state.fadeOn += 10;
        } else {
            state.fadeOn = null;
        }
    },
    setFadeOn: (state, action: PayloadAction<number | null>) => {
        state.fadeOn = action.payload;
    },
    setHorizonDistance: (state, action: PayloadAction<number>) => {
        state.horizonDistance = action.payload;
    },
    setSkyColor: (state, action: PayloadAction<RGBColor>) => {
        state.skyColor = action.payload;
    },
    setFloorColor: (state, action: PayloadAction<RGBColor>) => {
        state.floorColor = action.payload;
    },
  },
});
export default slice.reducer
// Actions
export const { initialize, setSkybox, toggleSkyboxEnabled, toggleFadingStrategy, setFadeOn, setHorizonDistance, setSkyColor, setFloorColor } = slice.actions
