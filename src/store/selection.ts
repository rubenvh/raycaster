import { IGeometry } from './../geometry/geometry';
import { buildSelectionTree, ISelectionTreeNode } from './../selection/selection-tree';
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { isEdge, isPolygon, isVertex, SelectableElement } from '../selection/selectable';

export type ISelectionState = {elements: SelectableElement[], tree: ISelectionTreeNode, treeSelection?: SelectableElement }

const slice = createSlice({
  name: 'selection',
  initialState: {      
      elements: [],  
      tree: {element: undefined, children:[]}
  } as ISelectionState,
  reducers: {
    addSelectedElement: (state, action: PayloadAction<{elements: SelectableElement[], geometry: IGeometry}>) => {        
        const {elements, geometry } = action.payload;        
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
        state.tree = buildSelectionTree(state.elements, geometry );        
    },
    startNewSelection: (state, action: PayloadAction<{elements: SelectableElement[], geometry: IGeometry}>) => {
        const {elements, geometry} = action.payload;
        state.elements = elements;
        state.tree = buildSelectionTree(elements, geometry );
        state.treeSelection = undefined;
    },    
    clearSelection: (state) => {
        state.elements = [];
        state.tree = {element: undefined, children:[]};
        state.treeSelection = undefined;
    },
    selectTreeNode: (state, action: PayloadAction<SelectableElement>) => {
        state.treeSelection = action.payload;
    }
  },
});
export default slice.reducer
// Actions
export const { addSelectedElement, startNewSelection, clearSelection, selectTreeNode } = slice.actions