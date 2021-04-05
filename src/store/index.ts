import { compose, configureStore } from '@reduxjs/toolkit'
import { combineReducers } from 'redux'
import stats from './stats'
import logger from 'redux-logger'
import { composeWithDevTools } from 'redux-devtools-extension';

const reducer = combineReducers({
  stats
})


const store = configureStore({
  reducer,  
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),//.concat(logger),
  devTools: true,//process.env.NODE_ENV !== 'production',
  enhancers: (defaultEnhancers) => [...defaultEnhancers]
})
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = () => store.dispatch;
export default store;