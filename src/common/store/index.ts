import { configureStore } from '@reduxjs/toolkit'
import { combineReducers } from 'redux'
import stats from './stats'
import logger from 'redux-logger'
import selection from './selection'
import player from './player'
import walls from './walls'
import worldConfig from './world-config'
import uiConfig from './ui-config'

const reducer = combineReducers({
  stats,
  selection,
  player,
  walls,
  worldConfig, 
  uiConfig
});

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