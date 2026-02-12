/**
 * Optimization Tracking Infrastructure
 * 
 * Tracks performance metrics across individual optimization tasks
 * to measure the impact of each change.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkResult } from './benchmark-types';

export interface OptimizationMetrics {
  /** Average frame time in ms (excluding warmup) */
  avgMs: number;
  /** 95% confidence interval */
  ci95Ms: number;
  /** Coefficient of variation (%) */
  cv: number;
  /** Number of test cases */
  testCases: number;
}

export interface TaskResult {
  /** Task ID (e.g., "T1") */
  taskId: string;
  /** Short name for the optimization */
  name: string;
  /** Description of what was changed */
  description: string;
  /** Timestamp when benchmark was run */
  timestamp: string;
  /** Metrics before this optimization (from previous task or baseline) */
  before: {
    zbuffer: OptimizationMetrics;
    raycaster: OptimizationMetrics;
  };
  /** Metrics after this optimization */
  after: {
    zbuffer: OptimizationMetrics;
    raycaster: OptimizationMetrics;
  };
  /** Calculated deltas */
  delta: {
    zbuffer: { deltaMs: number; deltaPercent: number; significant: boolean };
    raycaster: { deltaMs: number; deltaPercent: number; significant: boolean };
  };
}

export interface OptimizationTrackingData {
  /** When tracking started */
  startedAt: string;
  /** Initial baseline metrics */
  baseline: {
    zbuffer: OptimizationMetrics;
    raycaster: OptimizationMetrics;
  };
  /** Results for each optimization task */
  tasks: TaskResult[];
  /** Cumulative improvement from baseline */
  cumulative?: {
    zbuffer: { deltaMs: number; deltaPercent: number };
    raycaster: { deltaMs: number; deltaPercent: number };
  };
}

const TRACKING_FILE = path.join(__dirname, '../../../benchmark-results/optimization-tracking.json');

/**
 * Extract summary metrics from benchmark results
 */
export function extractMetrics(results: BenchmarkResult[]): { zbuffer: OptimizationMetrics; raycaster: OptimizationMetrics } {
  const zbufferResults = results.filter(r => r.config.renderer === 'ZBuffer (BSP)');
  const raycasterResults = results.filter(r => r.config.renderer === 'Raycaster');

  const calcMetrics = (items: BenchmarkResult[]): OptimizationMetrics => {
    if (items.length === 0) {
      return { avgMs: 0, ci95Ms: 0, cv: 0, testCases: 0 };
    }
    const avgMs = items.reduce((sum, r) => sum + (r.metrics.avgExcludingWarmup || r.metrics.avgFrameTimeMs), 0) / items.length;
    const ci95Ms = items.reduce((sum, r) => sum + (r.metrics.ci95ExcludingWarmup || r.metrics.confidence95Ms || 0), 0) / items.length;
    const cv = items.reduce((sum, r) => sum + (r.metrics.coeffOfVariation || 0), 0) / items.length;
    return { avgMs, ci95Ms, cv, testCases: items.length };
  };

  return {
    zbuffer: calcMetrics(zbufferResults),
    raycaster: calcMetrics(raycasterResults),
  };
}

/**
 * Load existing tracking data or create new
 */
export function loadTrackingData(): OptimizationTrackingData | null {
  try {
    if (fs.existsSync(TRACKING_FILE)) {
      const data = fs.readFileSync(TRACKING_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading tracking data:', e);
  }
  return null;
}

/**
 * Save tracking data
 */
export function saveTrackingData(data: OptimizationTrackingData): void {
  const dir = path.dirname(TRACKING_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
  console.log(`Tracking data saved to: ${TRACKING_FILE}`);
}

/**
 * Initialize tracking with baseline metrics
 */
export function initializeTracking(baselineResults: BenchmarkResult[]): OptimizationTrackingData {
  const baseline = extractMetrics(baselineResults);
  const data: OptimizationTrackingData = {
    startedAt: new Date().toISOString(),
    baseline,
    tasks: [],
  };
  saveTrackingData(data);
  return data;
}

/**
 * Record a task result
 */
export function recordTaskResult(
  trackingData: OptimizationTrackingData,
  taskId: string,
  name: string,
  description: string,
  afterResults: BenchmarkResult[]
): TaskResult {
  const after = extractMetrics(afterResults);
  
  // Get "before" from previous task or baseline
  const before = trackingData.tasks.length > 0
    ? trackingData.tasks[trackingData.tasks.length - 1].after
    : trackingData.baseline;

  // Calculate deltas
  const calcDelta = (beforeVal: number, afterVal: number, ci95: number) => {
    const deltaMs = afterVal - beforeVal;
    const deltaPercent = beforeVal !== 0 ? (deltaMs / beforeVal) * 100 : 0;
    // Significant if delta is larger than confidence interval
    const significant = Math.abs(deltaMs) > ci95;
    return { deltaMs, deltaPercent, significant };
  };

  const delta = {
    zbuffer: calcDelta(before.zbuffer.avgMs, after.zbuffer.avgMs, after.zbuffer.ci95Ms),
    raycaster: calcDelta(before.raycaster.avgMs, after.raycaster.avgMs, after.raycaster.ci95Ms),
  };

  const taskResult: TaskResult = {
    taskId,
    name,
    description,
    timestamp: new Date().toISOString(),
    before,
    after,
    delta,
  };

  trackingData.tasks.push(taskResult);

  // Update cumulative
  trackingData.cumulative = {
    zbuffer: {
      deltaMs: after.zbuffer.avgMs - trackingData.baseline.zbuffer.avgMs,
      deltaPercent: trackingData.baseline.zbuffer.avgMs !== 0
        ? ((after.zbuffer.avgMs - trackingData.baseline.zbuffer.avgMs) / trackingData.baseline.zbuffer.avgMs) * 100
        : 0,
    },
    raycaster: {
      deltaMs: after.raycaster.avgMs - trackingData.baseline.raycaster.avgMs,
      deltaPercent: trackingData.baseline.raycaster.avgMs !== 0
        ? ((after.raycaster.avgMs - trackingData.baseline.raycaster.avgMs) / trackingData.baseline.raycaster.avgMs) * 100
        : 0,
    },
  };

  saveTrackingData(trackingData);
  return taskResult;
}

/**
 * Print task result summary
 */
export function printTaskSummary(task: TaskResult): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Task ${task.taskId}: ${task.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Description: ${task.description}`);
  console.log(`\nResults:`);
  
  const formatDelta = (d: { deltaMs: number; deltaPercent: number; significant: boolean }) => {
    const sign = d.deltaMs >= 0 ? '+' : '';
    const sigMarker = d.significant ? '*' : '';
    return `${sign}${d.deltaMs.toFixed(2)}ms (${sign}${d.deltaPercent.toFixed(1)}%)${sigMarker}`;
  };

  console.log(`  ZBuffer:   ${task.before.zbuffer.avgMs.toFixed(2)}ms -> ${task.after.zbuffer.avgMs.toFixed(2)}ms  [${formatDelta(task.delta.zbuffer)}]`);
  console.log(`  Raycaster: ${task.before.raycaster.avgMs.toFixed(2)}ms -> ${task.after.raycaster.avgMs.toFixed(2)}ms  [${formatDelta(task.delta.raycaster)}]`);
  console.log(`\n  (* = statistically significant change)`);
}

/**
 * Generate markdown report for external graphing
 */
export function generateMarkdownReport(data: OptimizationTrackingData): string {
  let md = `# Optimization Performance Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary table
  md += `## Summary\n\n`;
  md += `| Task | Name | ZBuffer Δ | Raycaster Δ | Significant |\n`;
  md += `|------|------|-----------|-------------|-------------|\n`;
  
  for (const task of data.tasks) {
    const zbSig = task.delta.zbuffer.significant ? '✓' : '';
    const rcSig = task.delta.raycaster.significant ? '✓' : '';
    const sig = zbSig || rcSig ? 'Yes' : 'No';
    md += `| ${task.taskId} | ${task.name} | ${task.delta.zbuffer.deltaPercent.toFixed(1)}% | ${task.delta.raycaster.deltaPercent.toFixed(1)}% | ${sig} |\n`;
  }

  // Cumulative
  if (data.cumulative) {
    md += `\n### Cumulative Improvement from Baseline\n\n`;
    md += `- **ZBuffer**: ${data.cumulative.zbuffer.deltaPercent.toFixed(1)}% (${data.cumulative.zbuffer.deltaMs.toFixed(2)}ms)\n`;
    md += `- **Raycaster**: ${data.cumulative.raycaster.deltaPercent.toFixed(1)}% (${data.cumulative.raycaster.deltaMs.toFixed(2)}ms)\n`;
  }

  // Data for graphing
  md += `\n## Data for Graphing\n\n`;
  md += `### ZBuffer Frame Time (ms)\n\n`;
  md += `| Task | Before | After | Delta |\n`;
  md += `|------|--------|-------|-------|\n`;
  md += `| Baseline | - | ${data.baseline.zbuffer.avgMs.toFixed(2)} | - |\n`;
  for (const task of data.tasks) {
    md += `| ${task.taskId} | ${task.before.zbuffer.avgMs.toFixed(2)} | ${task.after.zbuffer.avgMs.toFixed(2)} | ${task.delta.zbuffer.deltaMs.toFixed(2)} |\n`;
  }

  md += `\n### Raycaster Frame Time (ms)\n\n`;
  md += `| Task | Before | After | Delta |\n`;
  md += `|------|--------|-------|-------|\n`;
  md += `| Baseline | - | ${data.baseline.raycaster.avgMs.toFixed(2)} | - |\n`;
  for (const task of data.tasks) {
    md += `| ${task.taskId} | ${task.before.raycaster.avgMs.toFixed(2)} | ${task.after.raycaster.avgMs.toFixed(2)} | ${task.delta.raycaster.deltaMs.toFixed(2)} |\n`;
  }

  // CSV format for easy import
  md += `\n## CSV Data (for spreadsheet import)\n\n`;
  md += `\`\`\`csv\n`;
  md += `Task,Name,ZBuffer_Before_ms,ZBuffer_After_ms,ZBuffer_Delta_pct,Raycaster_Before_ms,Raycaster_After_ms,Raycaster_Delta_pct\n`;
  for (const task of data.tasks) {
    md += `${task.taskId},${task.name},${task.before.zbuffer.avgMs.toFixed(2)},${task.after.zbuffer.avgMs.toFixed(2)},${task.delta.zbuffer.deltaPercent.toFixed(1)},${task.before.raycaster.avgMs.toFixed(2)},${task.after.raycaster.avgMs.toFixed(2)},${task.delta.raycaster.deltaPercent.toFixed(1)}\n`;
  }
  md += `\`\`\`\n`;

  return md;
}
