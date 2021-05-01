import { IGeometry } from './../geometry/geometry';
import { buildSelectionTree, ISelectionTreeNode } from './../selection/selection-tree';
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { findSelectedIndex, isEdge, isPolygon, isSelected, isVertex, SelectableElement } from '../selection/selectable';

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
        let treeSelection = state.treeSelection;
        elements.forEach(s => {                                    
            let i = findSelectedIndex(s, state.elements);
        
            if (i === -1) {            
                treeSelection = s;
                state.elements.push(s);
            } else {
                state.elements.splice(i, 1);
            }    
        });  
        state.tree = buildSelectionTree(state.elements, geometry );   
        state.treeSelection = isSelected(treeSelection, state.elements) ? treeSelection : undefined;
    },
    startNewSelection: (state, action: PayloadAction<{elements: SelectableElement[], geometry: IGeometry}>) => {
        const {elements, geometry} = action.payload;
        state.elements = elements;
        state.tree = buildSelectionTree(elements, geometry );
        state.treeSelection = elements.length > 0 ? elements[0] : undefined;
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