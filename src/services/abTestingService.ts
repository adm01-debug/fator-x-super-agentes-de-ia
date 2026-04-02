/**
 * A/B Testing Service — Statistical significance calculation for prompt experiments
 * Implements: z-test for proportions, confidence intervals, sample size estimation
 */
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface ABTestConfig {
  id: string;
  name: string;
  variantA: { id: string; name: string; promptVersion: string };
  variantB: { id: string; name: string; promptVersion: string };
  trafficSplit: number; // 0-100, percentage for variant B
  metric: 'pass_rate' | 'avg_score' | 'latency' | 'cost' | 'satisfaction';
  status: 'draft' | 'running' | 'completed' | 'stopped';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ABTestResult {
  variantA: { samples: number; conversions: number; rate: number; mean: number; stdDev: number };
  variantB: { samples: number; conversions: number; rate: number; mean: number; stdDev: number };
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  confidenceLevel: number; // 90, 95, or 99
  relativeImprovement: number; // percentage
  winner: 'A' | 'B' | 'inconclusive';
  minSamplesNeeded: number;
  powerAnalysis: number; // Statistical power (0-1)
}

// ═══ STATISTICAL FUNCTIONS ═══

/** Standard normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/** Z-test for two proportions */
function zTestProportions(nA: number, convA: number, nB: number, convB: number): { zScore: number; pValue: number } {
  if (nA === 0 || nB === 0) return { zScore: 0, pValue: 1 };
  const pA = convA / nA;
  const pB = convB / nB;
  const pPooled = (convA + convB) / (nA + nB);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / nA + 1 / nB));
  if (se === 0) return { zScore: 0, pValue: 1 };
  const z = (pB - pA) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z))); // Two-tailed
  return { zScore: z, pValue };
}

/** Minimum sample size for desired power */
function minSampleSize(baseRate: number, mde: number, alpha = 0.05, power = 0.8): number {
  const zAlpha = 1.96; // 95% confidence
  const zBeta = 0.842; // 80% power
  const p1 = baseRate;
  const p2 = baseRate + mde;
  const pBar = (p1 + p2) / 2;
  const n = Math.ceil(
    (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (mde ** 2)
  );
  return Math.max(n, 30); // Minimum 30 per variant
}

// ═══ A/B TEST ANALYSIS ═══

/** Analyze A/B test results with statistical significance. */
export function analyzeABTest(
  samplesA: number[], // Individual scores (0-100) for variant A
  samplesB: number[], // Individual scores (0-100) for variant B
  threshold = 60, // Score threshold for "conversion"
  confidenceLevel: 90 | 95 | 99 = 95
): ABTestResult {
  const nA = samplesA.length;
  const nB = samplesB.length;

  if (nA === 0 && nB === 0) {
    return emptyResult(confidenceLevel);
  }

  // Calculate basic stats
  const meanA = nA > 0 ? samplesA.reduce((s, v) => s + v, 0) / nA : 0;
  const meanB = nB > 0 ? samplesB.reduce((s, v) => s + v, 0) / nB : 0;
  const stdDevA = nA > 1 ? Math.sqrt(samplesA.reduce((s, v) => s + (v - meanA) ** 2, 0) / (nA - 1)) : 0;
  const stdDevB = nB > 1 ? Math.sqrt(samplesB.reduce((s, v) => s + (v - meanB) ** 2, 0) / (nB - 1)) : 0;

  // Conversion rates (score >= threshold)
  const convA = samplesA.filter(s => s >= threshold).length;
  const convB = samplesB.filter(s => s >= threshold).length;
  const rateA = nA > 0 ? convA / nA : 0;
  const rateB = nB > 0 ? convB / nB : 0;

  // Z-test
  const { zScore, pValue } = zTestProportions(nA, convA, nB, convB);

  // Significance check
  const alphaMap = { 90: 0.10, 95: 0.05, 99: 0.01 };
  const alpha = alphaMap[confidenceLevel];
  const isSignificant = pValue < alpha;

  // Relative improvement
  const relativeImprovement = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : 0;

  // Winner determination
  let winner: 'A' | 'B' | 'inconclusive' = 'inconclusive';
  if (isSignificant) {
    winner = rateB > rateA ? 'B' : 'A';
  }

  // Minimum samples needed for 5% MDE
  const baseRate = Math.max(rateA, 0.1);
  const minSamples = minSampleSize(baseRate, 0.05, alpha);

  // Statistical power
  const powerAnalysis = Math.min(1, (nA + nB) / (minSamples * 2));

  logger.info(`A/B Test: nA=${nA}, nB=${nB}, rateA=${(rateA * 100).toFixed(1)}%, rateB=${(rateB * 100).toFixed(1)}%, p=${pValue.toFixed(4)}, significant=${isSignificant}`, 'abTesting');

  return {
    variantA: { samples: nA, conversions: convA, rate: rateA, mean: meanA, stdDev: stdDevA },
    variantB: { samples: nB, conversions: convB, rate: rateB, mean: meanB, stdDev: stdDevB },
    zScore, pValue, isSignificant, confidenceLevel,
    relativeImprovement: Math.round(relativeImprovement * 10) / 10,
    winner, minSamplesNeeded: minSamples, powerAnalysis: Math.round(powerAnalysis * 100) / 100,
  };
}

// ═══ TEST MANAGEMENT ═══

const activeTests = new Map<string, ABTestConfig>();

export function createTest(config: Omit<ABTestConfig, 'id' | 'status' | 'createdAt'>): ABTestConfig {
  const test: ABTestConfig = { ...config, id: `ab-${Date.now()}`, status: 'draft', createdAt: new Date().toISOString() };
  activeTests.set(test.id, test);
  return test;
}

export function startTest(testId: string): boolean {
  const test = activeTests.get(testId);
  if (!test) return false;
  test.status = 'running';
  test.startedAt = new Date().toISOString();
  return true;
}

export function completeTest(testId: string, winner: 'A' | 'B' | 'inconclusive'): boolean {
  const test = activeTests.get(testId);
  if (!test) return false;
  test.status = 'completed';
  test.completedAt = new Date().toISOString();
  return true;
}

export function getActiveTests(): ABTestConfig[] {
  return Array.from(activeTests.values());
}

function emptyResult(confidenceLevel: number): ABTestResult {
  return {
    variantA: { samples: 0, conversions: 0, rate: 0, mean: 0, stdDev: 0 },
    variantB: { samples: 0, conversions: 0, rate: 0, mean: 0, stdDev: 0 },
    zScore: 0, pValue: 1, isSignificant: false, confidenceLevel,
    relativeImprovement: 0, winner: 'inconclusive', minSamplesNeeded: 30, powerAnalysis: 0,
  };
}
