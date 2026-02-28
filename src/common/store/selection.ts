import { IGeometry } from './../geometry/geometry';
import { buildSelectionTree, ISelectionTreeNode } from './../selection/selection-tree';
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { findSelectedIndex, isSelected, SelectableElement, selectWorld, SingleSelectableElement } from '../selection/selectable';

const WORLD_SELECTION: SelectableElement = selectWorld();

export type ISelectionState = {elements: SingleSelectableElement[], tree: ISelectionTreeNode, treeSelection?: SelectableElement }

const slice = createSlice({
  name: 'selection',
  initialState: {      
      elements: [],  
      tree: {element: undefined, children:[]},
      treeSelection: WORLD_SELECTION
  } as ISelectionState,
  reducers: {
    addSelectedElement: (state, action: PayloadAction<{elements: SingleSelectableElement[], geometry: IGeometry}>) => {        
        const {elements, geometry } = action.payload;        
        let treeSelection: SelectableElement = state.treeSelection;
        elements.forEach(s => {                                    
            let i = findSelectedIndex(s, state.elements);
        
            if (i === -1) {            
                treeSelection = s;
                state.elements.push(s);
            } else {
                state.elements.splice(i, 1);
            }    
        });  
        state.tree = buildSelectionTree(state.elements, geometry);
        state.treeSelection = state.tree.element ?? (isSelected(treeSelection, state.elements) ? treeSelection : WORLD_SELECTION);
    },
    startNewSelection: (state, action: PayloadAction<{elements: SingleSelectableElement[], geometry: IGeometry}>) => {
        const {elements, geometry} = action.payload;
        state.elements = elements;
        state.tree = buildSelectionTree(elements, geometry);
        state.treeSelection = state.tree.element ?? (elements.length > 0 ? elements[0] : WORLD_SELECTION);
    },    
    clearSelection: (state) => {
        state.elements = [];
        state.tree = {element: undefined, children:[]};
        state.treeSelection = WORLD_SELECTION;
    },
    selectTreeNode: (state, action: PayloadAction<SelectableElement>) => {
        state.treeSelection = action.payload;
    }
  },
});
export default slice.reducer
// Actions
export const { addSelectedElement, startNewSelection, clearSelection, selectTreeNode } = slice.actions
