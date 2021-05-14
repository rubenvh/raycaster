import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { adaptAngle, adaptDepth, DEFAULT_CAMERA, ICamera, makeCamera, move, rotate, strafe } from '../camera';
import { IGeometry } from '../geometry/geometry';
// Slice
export type IPlayerState = {camera: ICamera }
const slice = createSlice({
  name: 'player',
  initialState: {      
      camera: DEFAULT_CAMERA,  
  } as IPlayerState,
  reducers: {
    initializeCamera: (state, action: PayloadAction<ICamera>) => {
        state.camera = action.payload;
    },
    rotateCamera: (state, action: PayloadAction<number>) => {       
        state.camera = rotate( action.payload, state.camera); 
    },
    strafeCamera: (state, action: PayloadAction<{direction: 1|-1, geometry: IGeometry}>) => {
        state.camera = strafe(action.payload.direction, state.camera, action.payload.geometry)
    },    
    moveCamera: (state, action: PayloadAction<{direction: 1|-1, geometry: IGeometry}>) => {
        state.camera = move(action.payload.direction, state.camera, action.payload.geometry)
    },
    changeCameraAngle: (state, action: PayloadAction<1|-1>) => {
        state.camera = adaptAngle( action.payload, state.camera);
    },
    changeCameraDepth: (state, action: PayloadAction<1|-1>) => {
        state.camera = adaptDepth( action.payload, state.camera);
    },
  },
});
export default slice.reducer
// Actions
export const { initializeCamera, rotateCamera, strafeCamera, moveCamera, changeCameraAngle, changeCameraDepth } = slice.actions