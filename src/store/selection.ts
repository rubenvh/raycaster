import { IGeometry } from './../geometry/geometry';
import { buildSelectionTree, ISelectionTree } from './../selection/selection-tree';
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { isEdge, isPolygon, isVertex, SelectableElement } from '../selection/selectable';
// Slice
export type ISelectionState = {elements: SelectableElement[], tree: ISelectionTree }
const slice = createSlice({
  name: 'selection',
  initialState: {      
      elements: [],  
      tree: {children:[]}
  } as ISelectionState,
  reducers: {
    addSelectedElement: (state, action: PayloadAction<{elements: SelectableElement[], geometry: IGeometry}>) => {        
        const {elements, } = action.payload;        
        elements.forEach(s => {                                    
            let i = state.elements.findIndex(_ => 
                _.kind=='polygon' && isPolygon(s) && _.polygon.id === s.polygon.id
                || _.kind == 'vertex' && isVertex(s) && _.vertex.id === s.vertex.id
                || _.kind == 'edge' && isEdge(s) && _.edge.id === s.edge.id)
        
            if (i === -1) {            
                state.elements.push(s);
            } else {
                state.elements.splice(i, 1);
            }    
        });   
    },
    startNewSelection: (state, action: PayloadAction<{elements: SelectableElement[], geometry: IGeometry}>) => {
        const {elements, geometry} = action.payload;
        state.elements = elements;
        state.tree = buildSelectionTree(elements, geometry );
    },    
    clearSelection: (state) => {
        state.elements = [];
        state.tree = {children:[]};
    }
  },
});
export default slice.reducer
// Actions
export const { addSelectedElement, startNewSelection, clearSelection } = slice.actions