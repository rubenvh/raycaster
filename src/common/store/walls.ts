import { createPolygon as doCreatePolygon, IPolygon } from './../geometry/polygon';
import { IEntityKey } from './../geometry/entity';
import { IEdge } from './../geometry/edge';
import { IStoredGeometry, loadGeometry, IGeometry, transformEdges, moveVertices, removeVertex, addPolygon, duplicatePolygons, 
  splitEdge as doSplitEdge,
  expandPolygon as doExpandPolygon, reversePolygon as doReversePolygon, splitPolygon as doSplitPolygon,
  rotatePolygon as doRotatePolygon,
  subdivideEdge as doSubdivideEdge,
  extrudeEdge as doExtrudeEdge,
  bevelVertex as doBevelVertex,
  insetEdge as doInsetEdge,
  flipPolygon as doFlipPolygon,
  scalePolygon as doScalePolygon,
  regularizePolygon as doRegularizePolygon,
  convexHull as doConvexHull,
  insetPolygon as doInsetPolygon,
  mergePolygons as doMergePolygons,
  alignVertices as doAlignVertices,
  alignPolygons as doAlignPolygons,
  weldVertices as doWeldVertices,
  createRegularPolygon as doCreateRegularPolygon } from './../geometry/geometry';
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
    expandPolygon: (state, action: PayloadAction<{edge: IEdge | null, polygon: IEntityKey, direction: Vector}>) => {
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
    rotatePolygon: (state, action: PayloadAction<{polygons: IEntityKey[], rotation: Vector, center?: Vector}>) => {
      const {polygons, rotation, center} = action.payload;
      undoableUpdate(state, doRotatePolygon(polygons, rotation, state.geometry, center));
    },
    editVertex: (state, action: PayloadAction<{direction: Vector, vertex: IVertex, polygonId: IEntityKey}>) => {
      const {vertex, polygonId, direction} = action.payload;
      const vertexMap = new Map<string, IVertex[]>([[polygonId, [vertex]]]);
      undoableUpdate(state, moveVertices(false, direction, vertexMap, state.geometry));
    },
    subdivideEdge: (state, action: PayloadAction<{edge: IEdge, polygon: IEntityKey, segments: number}>) => {
      const {edge, polygon, segments} = action.payload;
      undoableUpdate(state, doSubdivideEdge(edge, polygon, segments, state.geometry));
    },
    extrudeEdge: (state, action: PayloadAction<{edge: IEdge, polygon: IEntityKey, direction: Vector}>) => {
      const {edge, polygon, direction} = action.payload;
      undoableUpdate(state, doExtrudeEdge(edge, polygon, direction, state.geometry));
    },
    bevelVertex: (state, action: PayloadAction<{vertices: {vertex: IVertex, polygon: IEntityKey}[], distance: number, segments: number}>) => {
      const {vertices, distance, segments} = action.payload;
      const result = vertices.reduce((geo, {vertex, polygon}) => doBevelVertex(vertex, polygon, distance, segments, geo), state.geometry);
      undoableUpdate(state, result);
    },
    insetEdge: (state, action: PayloadAction<{edge: IEdge, polygon: IEntityKey, depth: number, splitRatio: number}>) => {
      const {edge, polygon, depth, splitRatio} = action.payload;
      undoableUpdate(state, doInsetEdge(edge, polygon, depth, splitRatio, state.geometry));
    },
    flipPolygon: (state, action: PayloadAction<{polygons: IEntityKey[], axis: 'horizontal' | 'vertical'}>) => {
      const {polygons, axis} = action.payload;
      undoableUpdate(state, doFlipPolygon(polygons, axis, state.geometry));
    },
    scalePolygon: (state, action: PayloadAction<{polygons: IEntityKey[], scaleX: number, scaleY: number}>) => {
      const {polygons, scaleX, scaleY} = action.payload;
      undoableUpdate(state, doScalePolygon(polygons, scaleX, scaleY, state.geometry));
    },
    regularizePolygon: (state, action: PayloadAction<{polygon: IEntityKey}>) => {
      undoableUpdate(state, doRegularizePolygon(action.payload.polygon, state.geometry));
    },
    convexHull: (state, action: PayloadAction<{polygon: IEntityKey}>) => {
      undoableUpdate(state, doConvexHull(action.payload.polygon, state.geometry));
    },
    insetPolygon: (state, action: PayloadAction<{polygon: IEntityKey, distance: number}>) => {
      const [, result] = doInsetPolygon(action.payload.polygon, action.payload.distance, state.geometry);
      undoableUpdate(state, result);
    },
    mergePolygons: (state, action: PayloadAction<{polygons: IEntityKey[]}>) => {
      undoableUpdate(state, doMergePolygons(action.payload.polygons, state.geometry));
    },
    alignVertices: (state, action: PayloadAction<{axis: 'horizontal' | 'vertical', verticesMap: IVertexMap}>) => {
      undoableUpdate(state, doAlignVertices(action.payload.axis, action.payload.verticesMap, state.geometry));
    },
    alignPolygons: (state, action: PayloadAction<{polygons: IEntityKey[], direction: 'top' | 'bottom' | 'left' | 'right' | 'center-h' | 'center-v'}>) => {
      undoableUpdate(state, doAlignPolygons(action.payload.polygons, action.payload.direction, state.geometry));
    },
    weldVertices: (state, action: PayloadAction<{verticesMap: IVertexMap}>) => {
      undoableUpdate(state, doWeldVertices(action.payload.verticesMap, state.geometry));
    },
    createRegularPolygon: (state, action: PayloadAction<{center: Vector, radius: number, sides: number}>) => {
      const {center, radius, sides} = action.payload;
      undoableUpdate(state, doCreateRegularPolygon(center, radius, sides, state.geometry));
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
export const { undo, redo, loadWalls, updateWalls, adaptEdges, splitEdge, move, remove, createPolygon, clonePolygon, 
              expandPolygon, reversePolygon, splitPolygon, rotatePolygon, editVertex,
              subdivideEdge, extrudeEdge, bevelVertex, insetEdge, flipPolygon, scalePolygon,
              regularizePolygon, convexHull, insetPolygon, mergePolygons, alignVertices, alignPolygons,
              weldVertices, createRegularPolygon } = slice.actions