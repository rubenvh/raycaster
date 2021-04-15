import { configureStore } from '@reduxjs/toolkit'
import { combineReducers } from 'redux'
import stats from './stats'
import logger from 'redux-logger'
import selection from './selection'
import player from './player'

const reducer = combineReducers({
  stats,
  selection,
  player
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