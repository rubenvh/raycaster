import { configureStore } from '@reduxjs/toolkit'
import { combineReducers } from 'redux'
import stats from './stats'
import {createLogger} from 'redux-logger'
import selection from './selection'
import player from './player'
import walls from './walls'
import worldConfig from './world-config'
import uiConfig from './ui-config'
import textures from './textures'

const reducer = combineReducers({
  stats,
  selection,
  player,
  walls,
  worldConfig, 
  uiConfig,
  textures
});

const logger = createLogger({
  predicate: (getState, action) => !action.type.startsWith('stats') && !action.type.startsWith('player')
})
const store = configureStore({
  reducer,  
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false
  }).concat(logger),
  devTools: process.env.NODE_ENV !== 'production',
  enhancers: (defaultEnhancers) => [...defaultEnhancers]
})
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = () => store.dispatch;
export default store;