/**
 * Anomaly Detection — Real-time monitoring with baseline deviation alerts
 * Implements: statistical anomaly detection, trend analysis, health scoring
 */
import * as traceService from './traceService';
import * as alertService from './alertService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface MetricBaseline {
  metric: string;
  mean: number;
  stdDev: number;
  p50: number;
  p95: number;
  p99: number;
  sampleCount: number;
  updatedAt: string;
}

export interface AnomalyResult {
  metric: string;
  currentValue: number;
  baselineMean: number;
  deviations: number; // Standard deviations from mean
  isAnomaly: boolean;
  severity: 'normal' | 'warning' | 'critical';
  trend: 'stable' | 'improving' | 'degrading';
}

export interface HealthScore {
  overall: number; // 0-100
  latency: number;
  errorRate: number;
  cost: number;
  throughput: number;
  satisfaction: number;
}

// ═══ BASELINE CALCULATION ═══

const baselines = new Map<string, MetricBaseline>();

/** Calculate baseline from historical traces. */
export function calculateBaselines(agentId?: string): Map<string, MetricBaseline> {
  const traces = traceService.getTraces(200, agentId);
  if (traces.length < 5) return baselines;

  // Latency baseline
  const latencies = traces.map(t => t.latency_ms).filter(l => l > 0);
  if (latencies.length > 0) {
    baselines.set('latency', calculateStats('latency', latencies));
  }

  // Cost baseline
  const costs = traces.map(t => t.cost_usd).filter(c => c > 0);
  if (costs.length > 0) {
    baselines.set('cost', calculateStats('cost', costs));
  }

  // Token usage baseline
  const tokens = traces.map(t => t.tokens_in + t.tokens_out).filter(t => t > 0);
  if (tokens.length > 0) {
    baselines.set('tokens', calculateStats('tokens', tokens));
  }

  // Error rate (rolling window)
  const errorCount = traces.filter(t => t.status === 'error').length;
  const errorRate = traces.length > 0 ? errorCount / traces.length : 0;
  baselines.set('error_rate', {
    metric: 'error_rate', mean: errorRate, stdDev: 0.05,
    p50: errorRate, p95: errorRate + 0.1, p99: errorRate + 0.2,
    sampleCount: traces.length, updatedAt: new Date().toISOString(),
  });

  logger.debug(`Baselines calculated from ${traces.length} traces`, 'anomalyDetection');
  return baselines;
}

function calculateStats(metric: string, values: number[]): MetricBaseline {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    metric, mean, stdDev,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
    sampleCount: values.length,
    updatedAt: new Date().toISOString(),
  };
}

// ═══ ANOMALY DETECTION ═══

/** Check if a value is anomalous compared to baseline. */
export function detectAnomaly(metric: string, currentValue: number, threshold = 2.5): AnomalyResult {
  const baseline = baselines.get(metric);

  if (!baseline || baseline.sampleCount < 5) {
    return { metric, currentValue, baselineMean: 0, deviations: 0, isAnomaly: false, severity: 'normal', trend: 'stable' };
  }

  const deviations = baseline.stdDev > 0 ? (currentValue - baseline.mean) / baseline.stdDev : 0;
  const absDevs = Math.abs(deviations);

  const isAnomaly = absDevs > threshold;
  const severity = absDevs > 4 ? 'critical' : absDevs > threshold ? 'warning' : 'normal';

  // Trend detection: compare last 5 vs baseline
  const recentTraces = traceService.getTraces(5);
  let trend: 'stable' | 'improving' | 'degrading' = 'stable';
  if (recentTraces.length >= 3) {
    const recentValues = recentTraces.map(t => {
      if (metric === 'latency') return t.latency_ms;
      if (metric === 'cost') return t.cost_usd;
      if (metric === 'tokens') return t.tokens_in + t.tokens_out;
      return 0;
    });
    const recentMean = recentValues.reduce((s, v) => s + v, 0) / recentValues.length;
    const drift = (recentMean - baseline.mean) / Math.max(baseline.mean, 0.001);
    if (drift > 0.2) trend = 'degrading';
    else if (drift < -0.2) trend = 'improving';
  }

  if (isAnomaly) {
    logger.warn(`Anomaly: ${metric} = ${currentValue.toFixed(2)} (${absDevs.toFixed(1)}σ from baseline ${baseline.mean.toFixed(2)})`, 'anomalyDetection');
  }

  return { metric, currentValue, baselineMean: baseline.mean, deviations, isAnomaly, severity, trend };
}

/** Run anomaly detection on all metrics. */
export function checkAllMetrics(): AnomalyResult[] {
  const traces = traceService.getTraces(5);
  if (traces.length === 0) return [];

  calculateBaselines();
  const results: AnomalyResult[] = [];

  // Check latest trace
  const latest = traces[0];
  results.push(detectAnomaly('latency', latest.latency_ms));
  results.push(detectAnomaly('cost', latest.cost_usd));
  results.push(detectAnomaly('tokens', latest.tokens_in + latest.tokens_out));

  // Error rate (last 10 traces)
  const recent10 = traceService.getTraces(10);
  const errorRate = recent10.filter(t => t.status === 'error').length / Math.max(recent10.length, 1);
  results.push(detectAnomaly('error_rate', errorRate));

  // Auto-create alerts for critical anomalies
  for (const result of results.filter(r => r.severity === 'critical')) {
    alertService.checkRules(); // Trigger alert rule evaluation
  }

  return results;
}

// ═══ HEALTH SCORE ═══

/** Calculate overall health score (0-100) for an agent or system. */
export function calculateHealthScore(agentId?: string): HealthScore {
  const traces = traceService.getTraces(50, agentId);
  if (traces.length === 0) return { overall: 100, latency: 100, errorRate: 100, cost: 100, throughput: 100, satisfaction: 100 };

  // Latency score: 100 if <2s, 50 if 5s, 0 if >15s
  const avgLatency = traces.reduce((s, t) => s + t.latency_ms, 0) / traces.length;
  const latencyScore = Math.max(0, Math.min(100, 100 - (avgLatency - 2000) / 130));

  // Error rate score: 100 if 0%, 50 if 5%, 0 if >20%
  const errorRate = traces.filter(t => t.status === 'error').length / traces.length;
  const errorScore = Math.max(0, Math.min(100, 100 - errorRate * 500));

  // Cost score: 100 if <$0.01/call, 50 if $0.05, 0 if >$0.20
  const avgCost = traces.reduce((s, t) => s + t.cost_usd, 0) / traces.length;
  const costScore = Math.max(0, Math.min(100, 100 - (avgCost - 0.01) / 0.002));

  // Throughput: based on traces per hour
  const timeSpanMs = traces.length > 1 ? new Date(traces[0].timestamp).getTime() - new Date(traces[traces.length - 1].timestamp).getTime() : 3600000;
  const tracesPerHour = traces.length / Math.max(timeSpanMs / 3600000, 0.1);
  const throughputScore = Math.min(100, tracesPerHour * 10); // 10 traces/hour = 100

  // Satisfaction: placeholder (would come from user feedback)
  const satisfactionScore = 80;

  const overall = Math.round((latencyScore * 0.25 + errorScore * 0.3 + costScore * 0.15 + throughputScore * 0.15 + satisfactionScore * 0.15));

  return {
    overall, latency: Math.round(latencyScore), errorRate: Math.round(errorScore),
    cost: Math.round(costScore), throughput: Math.round(throughputScore), satisfaction: satisfactionScore,
  };
}

/** Get baselines for display. */
export function getBaselines(): MetricBaseline[] {
  return Array.from(baselines.values());
}
