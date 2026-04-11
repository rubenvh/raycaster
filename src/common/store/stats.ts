import { CastingStats, EMPTY_STATS } from '../rendering/raycasting/raycaster';
import { createSlice } from '@reduxjs/toolkit'
import { ILineSegment } from '../math/lineSegment';
// Slice
export type IPerformanceStatistics = {
    drawing: number,
    casting: number,
    zbuffering: number,
    total: number,
    /** Optional detailed breakdown of 'drawing' (zbuffer renderer only) */
    background?: number,
    floorCeiling?: number,
    wallRendering?: number,
}
export type IIntersectionStatistics = { stats: CastingStats }
export type IDetectedEdge = { segment: ILineSegment; depth: number }
/** Edge counts from BSP dirty-edge tracking during rendering. */
export type IBspRenderStats = {
    /** Edges skipped in BSP walk because they were stale (removed/modified). */
    staleEdgesSkipped: number;
    /** Dirty edges tested via brute-force iteration from current geometry. */
    dirtyEdgesTested: number;
    /** Total edges tested (BSP walk + dirty). */
    edgesTested: number;
}
export type IStatsState = { performance: { timing: IPerformanceStatistics, fps: number }, intersections: IIntersectionStatistics, detectedEdges: IDetectedEdge[], bspRendering?: IBspRenderStats }
const slice = createSlice({
  name: 'stats',
  initialState: {
    performance: {
      timing: { drawing: 0, casting: 0, zbuffering: 0, total: 0 },
      fps: 0
    },
    intersections: { stats: EMPTY_STATS },
    detectedEdges: []
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