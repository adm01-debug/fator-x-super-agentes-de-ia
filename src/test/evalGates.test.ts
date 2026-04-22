import { describe, it, expect } from 'vitest';
import {
  computeGateForRun,
  DEFAULT_PASS_RATE_THRESHOLD,
  MAX_EVAL_STALENESS_DAYS,
  type EvalGateRun,
} from '@/services/evalGates';

function makeRun(overrides: Partial<EvalGateRun> = {}): EvalGateRun {
  return {
    id: 'run-1',
    agent_id: 'agent-1',
    dataset_id: 'ds-1',
    status: 'completed',
    total_items: 20,
    passed: 20,
    failed: 0,
    avg_score: 0.9,
    avg_latency_ms: 1200,
    total_cost_usd: 0.02,
    model: 'google/gemini-2.5-flash',
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('evalGates.computeGateForRun', () => {
  it('blocks when no run exists', () => {
    const gate = computeGateForRun(null);
    expect(gate.allow).toBe(false);
    expect(gate.pass_rate).toBe(0);
    expect(gate.staleness_days).toBeNull();
    expect(gate.threshold).toBe(DEFAULT_PASS_RATE_THRESHOLD);
  });

  it('allows when pass rate is above threshold and run is fresh', () => {
    const gate = computeGateForRun(makeRun({ passed: 18, failed: 2, total_items: 20 }));
    expect(gate.allow).toBe(true);
    expect(gate.pass_rate).toBeCloseTo(0.9, 5);
    expect(gate.reason).toMatch(/OK/);
  });

  it('blocks when pass rate is below threshold', () => {
    const gate = computeGateForRun(makeRun({ passed: 10, failed: 10, total_items: 20 }));
    expect(gate.allow).toBe(false);
    expect(gate.reason).toMatch(/abaixo do mínimo/);
  });

  it('blocks when run is stale beyond MAX_EVAL_STALENESS_DAYS', () => {
    const old = new Date(Date.now() - (MAX_EVAL_STALENESS_DAYS + 3) * 86_400_000).toISOString();
    const gate = computeGateForRun(makeRun({ completed_at: old }));
    expect(gate.allow).toBe(false);
    expect(gate.reason).toMatch(/acima do limite/);
    expect(gate.staleness_days).toBeGreaterThan(MAX_EVAL_STALENESS_DAYS);
  });

  it('respects custom threshold', () => {
    const gate = computeGateForRun(makeRun({ passed: 12, failed: 8, total_items: 20 }), 0.5);
    expect(gate.allow).toBe(true);
    expect(gate.threshold).toBe(0.5);
  });

  it('handles zero total_items without NaN', () => {
    const gate = computeGateForRun(makeRun({ total_items: 0, passed: 0, failed: 0 }));
    expect(gate.pass_rate).toBe(0);
    expect(gate.allow).toBe(false);
  });
});
