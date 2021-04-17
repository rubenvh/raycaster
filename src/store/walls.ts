import { IEntityKey } from './../geometry/entity';
import { IEdge } from './../geometry/edge';
import { IStoredGeometry, loadGeometry, IGeometry, transformEdges } from './../geometry/geometry';
import {splitEdge as makeEdgeSplit } from './../geometry/geometry';
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EMPTY_GEOMETRY } from '../geometry/geometry';
import { Vector } from '../math/vector';
import { projectOn } from '../math/lineSegment';
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
    },
    adaptEdges: (state, action: PayloadAction<{edgeMap: Map<IEntityKey, IEdge[]>, transformer: (_: IEdge) => IEdge}>) => {
        const updatedEdges = Array.from(action.payload.edgeMap.entries())
            .reduce((geo, [poligonId, edges]) => transformEdges(edges, poligonId, action.payload.transformer, geo), state.geometry);
        state.geometry = updatedEdges;
    },
    splitEdge: (state, action: PayloadAction<{edge: IEdge, poligon: IEntityKey, target: Vector}>) => {
      const cut = projectOn(action.payload.target, action.payload.edge.segment);
      state.geometry = makeEdgeSplit(cut, action.payload.edge, action.payload.poligon, state.geometry);
    }
  },
});
export default slice.reducer
// Actions
export const { loadWalls, updateWalls, adaptEdges, splitEdge } = slice.actions