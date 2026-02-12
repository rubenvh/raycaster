/**
 * Statistical comparison utilities for benchmark results.
 * 
 * Provides Welch's t-test for comparing benchmark runs and determining
 * if performance differences are statistically significant.
 */

import { BenchmarkResult, BenchmarkReport } from './benchmark-types';

/**
 * Result of comparing a single benchmark scenario between baseline and current.
 */
export interface BaselineComparison {
  /** Scenario identifier (e.g., "small-fast") */
  scenario: string;
  /** Renderer name */
  renderer: string;
  /** Baseline statistics */
  baseline: {
    avg: number;
    stdDev: number;
    n: number;
  };
  /** Current run statistics */
  current: {
    avg: number;
    stdDev: number;
    n: number;
  };
  /** Absolute difference (current - baseline) in ms */
  differenceMs: number;
  /** Percent change ((current - baseline) / baseline * 100) */
  percentChange: number;
  /** Welch's t-statistic */
  tStatistic: number;
  /** Two-tailed p-value */
  pValue: number;
  /** Whether the difference is statistically significant (p < 0.05) */
  isSignificant: boolean;
  /** Human-readable interpretation */
  interpretation: string;
}

/**
 * Perform Welch's t-test for two independent samples with unequal variances.
 * 
 * This is more robust than Student's t-test when sample sizes or variances differ,
 * which is common in benchmark comparisons.
 * 
 * @param sample1 - First sample (array of values)
 * @param sample2 - Second sample (array of values)
 * @returns t-statistic and approximate p-value
 */
export function welchTTest(
  sample1: number[],
  sample2: number[]
): { t: number; df: number; p: number } {
  const n1 = sample1.length;
  const n2 = sample2.length;
  
  if (n1 < 2 || n2 < 2) {
    return { t: 0, df: 0, p: 1 };
  }
  
  const mean1 = sample1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = sample2.reduce((a, b) => a + b, 0) / n2;
  
  const var1 = sample1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
  const var2 = sample2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);
  
  // Handle zero variance edge case
  if (var1 === 0 && var2 === 0) {
    return { t: mean1 === mean2 ? 0 : Infinity, df: n1 + n2 - 2, p: mean1 === mean2 ? 1 : 0 };
  }
  
  // Welch's t-statistic
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) {
    return { t: 0, df: 0, p: 1 };
  }
  
  const t = (mean1 - mean2) / se;
  
  // Welch-Satterthwaite degrees of freedom
  const num = Math.pow(var1 / n1 + var2 / n2, 2);
  const denom = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
  const df = denom === 0 ? n1 + n2 - 2 : num / denom;
  
  // Approximate p-value using normal distribution for large df
  // For more accurate results with small df, would need t-distribution
  const p = approximateTwoTailedPValue(t, df);
  
  return { t, df, p };
}

/**
 * Approximate two-tailed p-value for t-distribution.
 * Uses normal approximation for large df, beta approximation for small df.
 */
function approximateTwoTailedPValue(t: number, df: number): number {
  if (!isFinite(t) || !isFinite(df) || df <= 0) {
    return 1;
  }
  
  const absT = Math.abs(t);
  
  // For large df (>30), use normal approximation
  if (df > 30) {
    // Standard normal CDF approximation
    const z = absT;
    const p = 2 * (1 - normalCDF(z));
    return Math.max(0, Math.min(1, p));
  }
  
  // For smaller df, use a more accurate approximation
  // Based on the relationship between t-distribution and beta distribution
  const x = df / (df + t * t);
  const p = incompleteBeta(df / 2, 0.5, x);
  return Math.max(0, Math.min(1, p));
}

/**
 * Standard normal CDF approximation (Abramowitz and Stegun).
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

/**
 * Incomplete beta function approximation using continued fraction.
 */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  
  // Use symmetry relation if needed for better convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(b, a, 1 - x);
  }
  
  // Continued fraction approximation (Lentz's algorithm)
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  
  let f = 1, c = 1, d = 0;
  
  for (let m = 0; m <= 200; m++) {
    const m2 = 2 * m;
    
    // Even step
    let numerator = m === 0 ? 1 : (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + numerator * d;
    c = 1 + numerator / c;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= d * c;
    
    // Odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + numerator * d;
    c = 1 + numerator / c;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    f *= delta;
    
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  
  return front * (f - 1);
}

/**
 * Log gamma function approximation (Lanczos approximation).
 */
function lnGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }
  
  x -= 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }
  
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Compare current benchmark results against a baseline.
 * 
 * @param current - Current benchmark results
 * @param baseline - Baseline benchmark results to compare against
 * @param warmupFrames - Number of warmup frames to exclude (default: 10)
 * @returns Array of comparisons for each matching scenario
 */
export function compareToBaseline(
  current: BenchmarkResult[],
  baseline: BenchmarkResult[],
  warmupFrames: number = 10
): BaselineComparison[] {
  const comparisons: BaselineComparison[] = [];
  
  // Create lookup for baseline results
  const baselineMap = new Map<string, BenchmarkResult>();
  for (const result of baseline) {
    const key = `${result.config.mapName}-${result.config.materialPreset}-${result.config.renderer}`;
    baselineMap.set(key, result);
  }
  
  // Compare each current result to baseline
  for (const currentResult of current) {
    const key = `${currentResult.config.mapName}-${currentResult.config.materialPreset}-${currentResult.config.renderer}`;
    const baselineResult = baselineMap.get(key);
    
    if (!baselineResult) {
      continue; // No baseline for this scenario
    }
    
    // Extract frame times excluding warmup
    const currentTimes = currentResult.frames.slice(warmupFrames).map(f => f.renderTimeMs);
    const baselineTimes = baselineResult.frames.slice(warmupFrames).map(f => f.renderTimeMs);
    
    // Calculate statistics
    const currentAvg = currentTimes.reduce((a, b) => a + b, 0) / currentTimes.length;
    const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;
    
    const currentStdDev = Math.sqrt(
      currentTimes.reduce((sum, x) => sum + Math.pow(x - currentAvg, 2), 0) / currentTimes.length
    );
    const baselineStdDev = Math.sqrt(
      baselineTimes.reduce((sum, x) => sum + Math.pow(x - baselineAvg, 2), 0) / baselineTimes.length
    );
    
    // Perform Welch's t-test
    const { t, p } = welchTTest(currentTimes, baselineTimes);
    
    const differenceMs = currentAvg - baselineAvg;
    const percentChange = baselineAvg !== 0 ? (differenceMs / baselineAvg) * 100 : 0;
    const isSignificant = p < 0.05;
    
    // Generate interpretation
    let interpretation: string;
    if (!isSignificant) {
      interpretation = `No significant change (p=${p.toFixed(3)})`;
    } else if (differenceMs > 0) {
      interpretation = `REGRESSION: +${differenceMs.toFixed(2)}ms (+${percentChange.toFixed(1)}%), p=${p.toFixed(3)}`;
    } else {
      interpretation = `IMPROVEMENT: ${differenceMs.toFixed(2)}ms (${percentChange.toFixed(1)}%), p=${p.toFixed(3)}`;
    }
    
    comparisons.push({
      scenario: `${currentResult.config.mapName}-${currentResult.config.materialPreset}`,
      renderer: currentResult.config.renderer,
      baseline: {
        avg: baselineAvg,
        stdDev: baselineStdDev,
        n: baselineTimes.length,
      },
      current: {
        avg: currentAvg,
        stdDev: currentStdDev,
        n: currentTimes.length,
      },
      differenceMs,
      percentChange,
      tStatistic: t,
      pValue: p,
      isSignificant,
      interpretation,
    });
  }
  
  return comparisons;
}

/**
 * Format comparison results as a human-readable report.
 */
export function formatComparisonReport(comparisons: BaselineComparison[]): string {
  if (comparisons.length === 0) {
    return 'No baseline comparisons available.';
  }
  
  const lines: string[] = [
    '=' .repeat(80),
    'BASELINE COMPARISON REPORT',
    '=' .repeat(80),
    '',
  ];
  
  // Group by scenario
  const byScenario = new Map<string, BaselineComparison[]>();
  for (const c of comparisons) {
    const existing = byScenario.get(c.scenario) || [];
    existing.push(c);
    byScenario.set(c.scenario, existing);
  }
  
  // Summary counts
  let improvements = 0;
  let regressions = 0;
  let unchanged = 0;
  
  for (const [scenario, scenarioComparisons] of byScenario) {
    lines.push(`${scenario}:`);
    
    for (const c of scenarioComparisons) {
      const marker = c.isSignificant 
        ? (c.differenceMs > 0 ? '[REGRESS]' : '[IMPROVE]')
        : '[  OK   ]';
      
      lines.push(
        `  ${marker} ${c.renderer}: ` +
        `${c.baseline.avg.toFixed(2)}ms -> ${c.current.avg.toFixed(2)}ms ` +
        `(${c.differenceMs >= 0 ? '+' : ''}${c.differenceMs.toFixed(2)}ms, ` +
        `${c.percentChange >= 0 ? '+' : ''}${c.percentChange.toFixed(1)}%, ` +
        `p=${c.pValue.toFixed(3)})`
      );
      
      if (c.isSignificant) {
        if (c.differenceMs > 0) regressions++;
        else improvements++;
      } else {
        unchanged++;
      }
    }
    
    lines.push('');
  }
  
  // Summary
  lines.push('-'.repeat(80));
  lines.push(`Summary: ${improvements} improvements, ${regressions} regressions, ${unchanged} unchanged`);
  
  if (regressions > 0) {
    lines.push('');
    lines.push('WARNING: Performance regressions detected!');
  }
  
  return lines.join('\n');
}

/**
 * Load baseline from a JSON file.
 */
export function loadBaseline(filePath: string): BenchmarkReport | null {
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as BenchmarkReport;
  } catch {
    return null;
  }
}

/**
 * Save current results as the new baseline.
 */
export function saveBaseline(report: BenchmarkReport, filePath: string): void {
  const fs = require('fs');
  const path = require('path');
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
}
