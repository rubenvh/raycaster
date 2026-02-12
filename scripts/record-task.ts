/**
 * Record an optimization task result after running benchmarks
 * 
 * Usage: npx ts-node scripts/record-task.ts <taskId> <name> <description>
 * Example: npx ts-node scripts/record-task.ts T1 spread-operator "Replace push(...hits) with for loop"
 */
import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkReport } from '../src/common/rendering/benchmark-types';
import { 
  loadTrackingData,
  recordTaskResult,
  printTaskSummary,
  generateMarkdownReport 
} from '../src/common/rendering/optimization-tracker';

const RESULTS_FILE = path.join(__dirname, '../benchmark-results/rendering-metrics.json');
const REPORT_FILE = path.join(__dirname, '../benchmark-results/optimization-report.md');

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: npx ts-node scripts/record-task.ts <taskId> <name> <description>');
  console.error('Example: npx ts-node scripts/record-task.ts T1 spread-operator "Replace push(...hits) with for loop"');
  process.exit(1);
}

const [taskId, name, description] = args;

// Load tracking data
const trackingData = loadTrackingData();
if (!trackingData) {
  console.error('No tracking data found. Run init-optimization-tracking.ts first.');
  process.exit(1);
}

// Load current benchmark results
const resultsJson = fs.readFileSync(RESULTS_FILE, 'utf-8');
const report: BenchmarkReport = JSON.parse(resultsJson);

// Record the task
const taskResult = recordTaskResult(trackingData, taskId, name, description, report.results);
printTaskSummary(taskResult);

// Update markdown report
const mdReport = generateMarkdownReport(trackingData);
fs.writeFileSync(REPORT_FILE, mdReport);
console.log(`\nMarkdown report updated: ${REPORT_FILE}`);

// Show cumulative progress
if (trackingData.cumulative) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('Cumulative Progress from Baseline:');
  console.log(`${'='.repeat(70)}`);
  console.log(`  ZBuffer:   ${trackingData.cumulative.zbuffer.deltaPercent >= 0 ? '+' : ''}${trackingData.cumulative.zbuffer.deltaPercent.toFixed(1)}% (${trackingData.cumulative.zbuffer.deltaMs >= 0 ? '+' : ''}${trackingData.cumulative.zbuffer.deltaMs.toFixed(2)}ms)`);
  console.log(`  Raycaster: ${trackingData.cumulative.raycaster.deltaPercent >= 0 ? '+' : ''}${trackingData.cumulative.raycaster.deltaPercent.toFixed(1)}% (${trackingData.cumulative.raycaster.deltaMs >= 0 ? '+' : ''}${trackingData.cumulative.raycaster.deltaMs.toFixed(2)}ms)`);
}
