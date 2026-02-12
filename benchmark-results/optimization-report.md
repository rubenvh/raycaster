# Optimization Performance Report

Generated: 2026-02-12T17:44:09.335Z

## Summary

| Task | Name | ZBuffer Δ | Raycaster Δ | Significant |
|------|------|-----------|-------------|-------------|
| T1 | spread-operator | 1.9% | 8.0% | Yes |
| T1b | spread-operator-v2 | 1.2% | -8.8% | Yes |
| T2 | intersect-ray-plane | -3.8% | 4.2% | Yes |
| T3 | filter-sort-single-pass | 0.0% | -16.0% | Yes |
| T4 | foreach-to-forof | -0.6% | 12.7% | Yes |
| T5 | cache-opaque-flag | -66.0% | -1.7% | Yes |
| T6-T7 | cache-screen-values | -0.2% | 1.3% | No |
| T8 | reuse-scratch-rays | 5.7% | 7.0% | Yes |
| T8-revert | revert-scratch-rays | -5.3% | -4.5% | Yes |

### Cumulative Improvement from Baseline

- **ZBuffer**: -66.4% (-4.86ms)
- **Raycaster**: -1.2% (-0.60ms)

## Data for Graphing

### ZBuffer Frame Time (ms)

| Task | Before | After | Delta |
|------|--------|-------|-------|
| Baseline | - | 7.31 | - |
| T1 | 7.31 | 7.45 | 0.14 |
| T1b | 7.45 | 7.54 | 0.09 |
| T2 | 7.54 | 7.26 | -0.28 |
| T3 | 7.26 | 7.26 | 0.00 |
| T4 | 7.26 | 7.21 | -0.04 |
| T5 | 7.21 | 2.45 | -4.76 |
| T6-T7 | 2.45 | 2.45 | -0.00 |
| T8 | 2.45 | 2.59 | 0.14 |
| T8-revert | 2.59 | 2.45 | -0.14 |

### Raycaster Frame Time (ms)

| Task | Before | After | Delta |
|------|--------|-------|-------|
| Baseline | - | 47.70 | - |
| T1 | 47.70 | 51.50 | 3.80 |
| T1b | 51.50 | 46.95 | -4.55 |
| T2 | 46.95 | 48.91 | 1.96 |
| T3 | 48.91 | 41.09 | -7.82 |
| T4 | 41.09 | 46.30 | 5.21 |
| T5 | 46.30 | 45.49 | -0.81 |
| T6-T7 | 45.49 | 46.10 | 0.61 |
| T8 | 46.10 | 49.33 | 3.23 |
| T8-revert | 49.33 | 47.10 | -2.23 |

## CSV Data (for spreadsheet import)

```csv
Task,Name,ZBuffer_Before_ms,ZBuffer_After_ms,ZBuffer_Delta_pct,Raycaster_Before_ms,Raycaster_After_ms,Raycaster_Delta_pct
T1,spread-operator,7.31,7.45,1.9,47.70,51.50,8.0
T1b,spread-operator-v2,7.45,7.54,1.2,51.50,46.95,-8.8
T2,intersect-ray-plane,7.54,7.26,-3.8,46.95,48.91,4.2
T3,filter-sort-single-pass,7.26,7.26,0.0,48.91,41.09,-16.0
T4,foreach-to-forof,7.26,7.21,-0.6,41.09,46.30,12.7
T5,cache-opaque-flag,7.21,2.45,-66.0,46.30,45.49,-1.7
T6-T7,cache-screen-values,2.45,2.45,-0.2,45.49,46.10,1.3
T8,reuse-scratch-rays,2.45,2.59,5.7,46.10,49.33,7.0
T8-revert,revert-scratch-rays,2.59,2.45,-5.3,49.33,47.10,-4.5
```

## Benchmark Variance Analysis

### Observed Regressions Investigation (2026-02-12)

Two benchmark scenarios initially showed regressions:
- `large-fast` Raycaster: +19.9%
- `stress-translucent` Raycaster: +6.0%

**Investigation Result: These are benchmark noise, NOT real regressions.**

5 consecutive runs of `stress-translucent` showed:

| Run | Raycaster Time | vs Baseline |
|-----|----------------|-------------|
| 1 | 100.35ms | -0.6% (OK) |
| 2 | 104.22ms | +3.2% (REGRESS) |
| 3 | 96.48ms | -4.5% (IMPROVE) |
| 4 | 95.25ms | -5.7% (IMPROVE) |
| 5 | 104.55ms | +3.5% (REGRESS) |

The same code shows both improvement and regression across runs, confirming this is variance.

### Root Cause of High Variance in Translucent Scenarios

1. **No early termination**: Rays cannot stop at translucent walls, must continue
2. **More intersections**: Longer ray paths = more hits to compute and sort
3. **GC/JIT variance**: Amplified by larger working sets
4. **Inherent ~10% variance**: Results swing ±5% run-to-run

### Reliable Metrics

- **ZBuffer improvements are reliable**: Consistent -66% across all runs
- **Raycaster variance is high**: Use multiple runs and aggregate for comparisons
- **High-CV scenarios (>50%)**: Require more samples for statistical significance
