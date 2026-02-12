/**
 * Initialize optimization tracking with current benchmark results as baseline
 */
import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkReport } from '../src/common/rendering/benchmark-types';
import { 
  initializeTracking, 
  loadTrackingData,
  generateMarkdownReport,
  saveTrackingData 
} from '../src/common/rendering/optimization-tracker';

const RESULTS_FILE = path.join(__dirname, '../benchmark-results/rendering-metrics.json');
const REPORT_FILE = path.join(__dirname, '../benchmark-results/optimization-report.md');

// Load current benchmark results
const resultsJson = fs.readFileSync(RESULTS_FILE, 'utf-8');
const report: BenchmarkReport = JSON.parse(resultsJson);

// Check if we already have tracking data
let trackingData = loadTrackingData();

if (trackingData) {
  console.log('Existing tracking data found.');
  console.log(`  Started: ${trackingData.startedAt}`);
  console.log(`  Tasks completed: ${trackingData.tasks.length}`);
  console.log(`  Baseline ZBuffer: ${trackingData.baseline.zbuffer.avgMs.toFixed(2)}ms`);
  console.log(`  Baseline Raycaster: ${trackingData.baseline.raycaster.avgMs.toFixed(2)}ms`);
  
  if (trackingData.cumulative) {
    console.log(`\nCumulative improvement:`);
    console.log(`  ZBuffer: ${trackingData.cumulative.zbuffer.deltaPercent.toFixed(1)}%`);
    console.log(`  Raycaster: ${trackingData.cumulative.raycaster.deltaPercent.toFixed(1)}%`);
  }
} else {
  console.log('No tracking data found. Initializing with current results as baseline...');
  trackingData = initializeTracking(report.results);
  console.log('Tracking initialized!');
  console.log(`  Baseline ZBuffer: ${trackingData.baseline.zbuffer.avgMs.toFixed(2)}ms`);
  console.log(`  Baseline Raycaster: ${trackingData.baseline.raycaster.avgMs.toFixed(2)}ms`);
}

// Generate markdown report
const mdReport = generateMarkdownReport(trackingData);
fs.writeFileSync(REPORT_FILE, mdReport);
console.log(`\nMarkdown report written to: ${REPORT_FILE}`);
