import { CastingStats, EMPTY_STATS } from './../raycaster';
import { createSlice } from '@reduxjs/toolkit'
// Slice
export type IPerformanceStatistics = {drawing:number, casting: number, zbuffering: number, total: number}
export type IIntersectionStatistics = {stats: CastingStats }
export type IStatsState = { performance: {timing: IPerformanceStatistics, fps: number}, intersections:IIntersectionStatistics}
const slice = createSlice({
  name: 'stats',
  initialState: {    
    performance: {
        timing: {drawing:0, casting: 0, zbuffering: 0, total: 0},
        fps: 0
    },
    intersections: {stats: EMPTY_STATS},
  } as IStatsState,
  reducers: {
    statisticsUpdated: (state, action) => {
        return action.payload;
      //state = {...action.payload};
    },
  },
});
export default slice.reducer
// Actions
export const { statisticsUpdated } = slice.actions