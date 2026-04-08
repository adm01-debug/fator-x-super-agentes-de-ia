/**
 * Oracle Comparison aggregate logic tests (T20.5)
 *
 * The reduce-style aggregation in OracleComparisonPanel decides:
 *  - which run is the winner (highest confidence_score)
 *  - total cost / tokens / avg latency across successful runs
 *  - what shape the export JSON has
 *
 * These calculations are pure and easy to test in isolation.
 */
import { describe, it, expect } from 'vitest';

interface MockRun {
  mode: 'council' | 'researcher' | 'advisor';
  status: 'success' | 'failed' | 'pending';
  duration_ms: number;
  result: {
    confidence_score: number;
    consensus_degree: number;
    final_response: string;
    metrics: {
      total_cost_usd: number;
      total_tokens: number;
      models_used: number;
    };
  } | null;
}

// Pure functions extracted from OracleComparisonPanel — kept in sync.
function pickWinner(runs: MockRun[]): MockRun['mode'] | null {
  const successful = runs.filter((r) => r.status === 'success' && r.result);
  if (successful.length === 0) return null;
  return successful.reduce((best, r) =>
    (r.result!.confidence_score ?? 0) > (best.result!.confidence_score ?? 0) ? r : best
  ).mode;
}

function aggregate(runs: MockRun[]) {
  const successful = runs.filter((r) => r.status === 'success' && r.result);
  const sum = successful.reduce(
    (acc, r) => ({
      cost: acc.cost + (r.result?.metrics?.total_cost_usd ?? 0),
      tokens: acc.tokens + (r.result?.metrics?.total_tokens ?? 0),
      avgLatency: acc.avgLatency + r.duration_ms,
    }),
    { cost: 0, tokens: 0, avgLatency: 0 }
  );
  if (successful.length > 0) sum.avgLatency = sum.avgLatency / successful.length;
  return sum;
}

const successfulRun = (
  mode: MockRun['mode'],
  conf: number,
  cost: number,
  tokens: number,
  duration: number
): MockRun => ({
  mode,
  status: 'success',
  duration_ms: duration,
  result: {
    confidence_score: conf,
    consensus_degree: 0.8,
    final_response: `response from ${mode}`,
    metrics: { total_cost_usd: cost, total_tokens: tokens, models_used: 3 },
  },
});

describe('Oracle Comparison — pickWinner', () => {
  it('returns null when no runs are successful', () => {
    const runs: MockRun[] = [
      { mode: 'council', status: 'failed', duration_ms: 100, result: null },
      { mode: 'researcher', status: 'pending', duration_ms: 0, result: null },
    ];
    expect(pickWinner(runs)).toBeNull();
  });

  it('picks the run with highest confidence_score', () => {
    const runs: MockRun[] = [
      successfulRun('council', 0.7, 0.01, 100, 1000),
      successfulRun('researcher', 0.95, 0.02, 200, 2000),
      successfulRun('advisor', 0.85, 0.005, 50, 500),
    ];
    expect(pickWinner(runs)).toBe('researcher');
  });

  it('ignores failed runs even if they would have higher confidence', () => {
    const runs: MockRun[] = [
      successfulRun('council', 0.5, 0.01, 100, 1000),
      { mode: 'researcher', status: 'failed', duration_ms: 100, result: null },
    ];
    expect(pickWinner(runs)).toBe('council');
  });

  it('returns first run when all confidences are tied', () => {
    const runs: MockRun[] = [
      successfulRun('council', 0.8, 0.01, 100, 1000),
      successfulRun('researcher', 0.8, 0.02, 200, 2000),
    ];
    // reduce keeps the first one when not strictly greater
    expect(pickWinner(runs)).toBe('council');
  });
});

describe('Oracle Comparison — aggregate', () => {
  it('returns zeros for empty input', () => {
    expect(aggregate([])).toEqual({ cost: 0, tokens: 0, avgLatency: 0 });
  });

  it('sums cost and tokens across successful runs', () => {
    const runs: MockRun[] = [
      successfulRun('council', 0.7, 0.01, 100, 1000),
      successfulRun('researcher', 0.9, 0.02, 250, 2000),
      successfulRun('advisor', 0.85, 0.005, 50, 500),
    ];
    const agg = aggregate(runs);
    expect(agg.cost).toBeCloseTo(0.035, 6);
    expect(agg.tokens).toBe(400);
  });

  it('computes average latency (not sum)', () => {
    const runs: MockRun[] = [
      successfulRun('council', 0.7, 0.01, 100, 1000),
      successfulRun('researcher', 0.9, 0.02, 250, 3000),
    ];
    const agg = aggregate(runs);
    expect(agg.avgLatency).toBe(2000);
  });

  it('excludes failed runs from aggregation', () => {
    const runs: MockRun[] = [
      successfulRun('council', 0.7, 0.01, 100, 1000),
      { mode: 'researcher', status: 'failed', duration_ms: 99999, result: null },
    ];
    const agg = aggregate(runs);
    expect(agg.cost).toBe(0.01);
    expect(agg.tokens).toBe(100);
    expect(agg.avgLatency).toBe(1000); // only the council run averaged
  });
});

describe('Oracle Comparison — export shape', () => {
  it('export payload has expected fields', () => {
    const query = 'test question';
    const runs: MockRun[] = [
      successfulRun('council', 0.8, 0.01, 100, 1000),
    ];
    const payload = {
      query,
      timestamp: new Date().toISOString(),
      runs: runs.map((r) => ({
        mode: r.mode,
        status: r.status,
        duration_ms: r.duration_ms,
        confidence_score: r.result?.confidence_score,
        consensus_degree: r.result?.consensus_degree,
        final_response: r.result?.final_response,
        metrics: r.result?.metrics,
      })),
    };
    expect(payload.query).toBe('test question');
    expect(payload.runs).toHaveLength(1);
    expect(payload.runs[0].mode).toBe('council');
    expect(payload.runs[0].confidence_score).toBe(0.8);
    expect(payload.runs[0].metrics?.total_cost_usd).toBe(0.01);
    // Round-trip JSON to ensure serialisable
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);
    expect(parsed.runs[0].metrics.total_tokens).toBe(100);
  });
});
