import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { isEdge, isPolygon, isVertex, SelectableElement } from '../geometry/selectable';
// Slice
export type ISelectionState = {elements: SelectableElement[] }
const slice = createSlice({
  name: 'selection',
  initialState: {      
      elements: [],  
  } as ISelectionState,
  reducers: {
    addSelectedElement: (state, action: PayloadAction<SelectableElement[]>) => {        
        const ss = action.payload;
        ss.forEach(s => {                                    
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
    startNewSelection: (state, action: PayloadAction<SelectableElement[]>) => {
        state.elements = action.payload;
    },    
    clearSelection: (state) => {
        state.elements = [];
    }
  },
});
export default slice.reducer
// Actions
export const { addSelectedElement, startNewSelection, clearSelection } = slice.actions