import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ISkyboxSource, ISkyboxRegion } from '../skybox/model';
import { Vector } from '../math/vector';
import { IMaterial } from '../geometry/properties';

export type RGBColor = [number, number, number];

export type ISkyGradient = {
  topColor: RGBColor,
  bottomColor: RGBColor,
  crossoverPosition?: number,  // 0–1, where the midpoint of the transition sits (default 0.5)
  crossoverWidth?: number,     // 0–1, how wide the transition band is (default 1.0 = full span)
};

/**
 * Compute the 2D sun direction vector from a sun angle.
 * sunAngle ranges from 0 (east/right horizon) to PI (west/left horizon).
 * At PI/2 the sun is directly overhead.
 * Returns a unit vector indicating where the light comes from.
 */
export const getSunDirection = (sunAngle: number): Vector =>
    [Math.cos(sunAngle), Math.sin(sunAngle)];

export const DEFAULT_SUN_ANGLE = Math.PI / 2; // noon — sun directly overhead

// Slice
export type IWorldConfigState = {
  fadeOn?: number,
  horizonDistance?: number,
  skybox?: ISkyboxSource,
  skyboxEnabled?: boolean,
  skyColor?: RGBColor,
  floorColor?: RGBColor,
  floorMaterial?: IMaterial,
  skyGradient?: ISkyGradient,
  sunAngle: number,
};

export const DEFAULT_SKY_COLOR: RGBColor = [200, 200, 200];
export const DEFAULT_FLOOR_COLOR: RGBColor = [50, 80, 80];
export const DEFAULT_FLOOR_MATERIAL: IMaterial = { color: [50, 80, 80, 1] };

const slice = createSlice({
  name: 'worldConfig',
  initialState: {      
      fadeOn: undefined,  
      horizonDistance: 300,
      skyboxEnabled: false,
      skyColor: DEFAULT_SKY_COLOR,
      floorColor: DEFAULT_FLOOR_COLOR,
      floorMaterial: DEFAULT_FLOOR_MATERIAL,
      sunAngle: DEFAULT_SUN_ANGLE,
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
    setSkyboxRegion: (state, action: PayloadAction<ISkyboxRegion | null>) => {
        if (state.skybox) {
            state.skybox.region = action.payload ?? undefined;
        }
    },
    setSkyboxVerticalTiling: (state, action: PayloadAction<boolean>) => {
        if (state.skybox) {
            state.skybox.verticalTiling = action.payload || undefined;
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
        state.floorMaterial = { color: [action.payload[0], action.payload[1], action.payload[2], 1] };
    },
    setFloorMaterial: (state, action: PayloadAction<IMaterial>) => {
        state.floorMaterial = action.payload;
        state.floorColor = [action.payload.color[0], action.payload.color[1], action.payload.color[2]];
    },
    setSkyGradient: (state, action: PayloadAction<ISkyGradient | null>) => {
        state.skyGradient = action.payload ?? undefined;
    },
    setSunAngle: (state, action: PayloadAction<number>) => {
        state.sunAngle = Math.max(0, Math.min(Math.PI, action.payload));
    },
    moveSun: (state, action: PayloadAction<number>) => {
        state.sunAngle = Math.max(0, Math.min(Math.PI, state.sunAngle + action.payload));
    },
  },
});
export default slice.reducer
// Actions
export const { initialize, setSkybox, toggleSkyboxEnabled, setSkyboxRegion, setSkyboxVerticalTiling, toggleFadingStrategy, setFadeOn, setHorizonDistance, setSkyColor, setFloorColor, setFloorMaterial, setSkyGradient, setSunAngle, moveSun } = slice.actions
