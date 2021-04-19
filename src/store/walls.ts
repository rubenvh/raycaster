import { createPolygon as doCreatePolygon, IPolygon } from './../geometry/polygon';
import { IEntityKey } from './../geometry/entity';
import { IEdge } from './../geometry/edge';
import { IStoredGeometry, loadGeometry, IGeometry, transformEdges, moveVertices, removeVertex, addPolygon, duplicatePolygons, 
  splitEdge as doSplitEdge,
  expandPolygon as doExpandPolygon, reversePolygon as doReversePolygon, splitPolygon as doSplitPolygon,
  rotatePolygon as doRotatePolygon } from './../geometry/geometry';
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EMPTY_GEOMETRY } from '../geometry/geometry';
import { Vector } from '../math/vector';
import { projectOn } from '../math/lineSegment';
import { IVertex, IVertexMap } from '../geometry/vertex';

export type IWallState = {geometry: IGeometry, history: IGeometry[], historyIndex: number }

const slice = createSlice({
  name: 'walls',
  initialState: {      
      geometry: EMPTY_GEOMETRY, 
      history: [EMPTY_GEOMETRY],
      historyIndex: 0, 
  } as IWallState,
  reducers: {
    loadWalls: (state, action: PayloadAction<IStoredGeometry>) => {      
      state.geometry = loadGeometry(action.payload);
      state.history = [state.geometry];
      state.historyIndex = 0;
    },
    updateWalls: (state, action: PayloadAction<IGeometry>) => {
      undoableUpdate(state, action.payload);      
    },
    undo: (state) => {
      state.historyIndex = Math.max(0, state.historyIndex - 1);
      state.geometry = state.history[state.historyIndex];
    },
    redo: (state) => {
      state.historyIndex = Math.min(state.history.length-1, state.historyIndex + 1);      
      state.geometry = state.history[state.historyIndex];
    },
    adaptEdges: (state, action: PayloadAction<{edgeMap: Map<IEntityKey, IEdge[]>, transformer: (_: IEdge) => IEdge}>) => {
      const updatedEdges = Array.from(action.payload.edgeMap.entries())
          .reduce((geo, [poligonId, edges]) => transformEdges(edges, poligonId, action.payload.transformer, geo), state.geometry);
      undoableUpdate(state, updatedEdges);          
    },
    splitEdge: (state, action: PayloadAction<{edge: IEdge, poligon: IEntityKey, target: Vector}>) => {
      const cut = projectOn(action.payload.target, action.payload.edge.segment);
      undoableUpdate(state, doSplitEdge(cut, action.payload.edge, action.payload.poligon, state.geometry));
    },
    move: (state, action: PayloadAction<{direction: Vector, verticesMap: IVertexMap, snap: boolean, disableUndo?: boolean}>) => {      
      const movedGeometry = moveVertices(action.payload.snap, action.payload.direction, action.payload.verticesMap, state.geometry);
      if (action.payload.disableUndo) {
        state.geometry = movedGeometry;
      } else {
        undoableUpdate(state, movedGeometry);
      }      
    },
    remove: (state, action: PayloadAction<IVertexMap>) => {      
      undoableUpdate(state, Array.from(action.payload.entries())
        .reduce((acc, [polygon, vertices]) => 
          vertices.reduce((_, vertex) => removeVertex(vertex, polygon, _), acc), 
          state.geometry));
    },
    createPolygon: (state, action: PayloadAction<Vector[]>) => {
      undoableUpdate(state, addPolygon(doCreatePolygon(action.payload), state.geometry));
    },
    clonePolygon: (state, action: PayloadAction<{polygons: IPolygon[], displacementIndex? : number}>) => {
      const displacement = (action.payload.displacementIndex??1) * 10;
      const [duplicated, ] = duplicatePolygons(
        action.payload.polygons, 
        [displacement, displacement], 
        state.geometry);
      undoableUpdate(state, duplicated);
    },
    expandPolygon: (state, action: PayloadAction<{edge: IEdge, polygon: IEntityKey, direction: Vector}>) => {
      const {edge, polygon, direction} = action.payload;
      const [,expanded] = doExpandPolygon(edge, polygon, direction, state.geometry);
      undoableUpdate(state, expanded);
    },
    reversePolygon: (state, action: PayloadAction<IEntityKey[]>) => {
      undoableUpdate(state, doReversePolygon(action.payload, state.geometry));
    },
    splitPolygon: (state, action: PayloadAction<{polygon: IEntityKey, start:IVertex, end: IVertex}>) => {
      const {polygon, start, end} = action.payload;
      undoableUpdate(state, doSplitPolygon(start, end, polygon, state.geometry));
    },
    rotatePolygon: (state, action: PayloadAction<{polygons: IEntityKey[], rotation: Vector}>) => {
      const {polygons, rotation} = action.payload;
      undoableUpdate(state, doRotatePolygon(polygons, rotation, state.geometry));
    }
  },
});


const undoableUpdate = (state: IWallState, geometry: IGeometry) => {
  state.geometry = geometry;
  if (!state.history.includes(state.geometry))
  {
    state.historyIndex += 1;
    state.history = state.history.slice(0, state.historyIndex).concat(state.geometry);
  }   
};

export default slice.reducer
// Actions
export const { undo, redo, loadWalls, updateWalls, adaptEdges, splitEdge, move, remove, createPolygon, clonePolygon, expandPolygon, reversePolygon, splitPolygon, rotatePolygon } = slice.actions