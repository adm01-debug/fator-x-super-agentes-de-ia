/**
 * executionHistoryService tests
 *
 * Covers: compareExecutions (pure), types validation.
 */
import { describe, it, expect } from 'vitest';
import { compareExecutions, type ExecutionRecord } from '@/services/executionHistoryService';

// ──────── Helpers ────────

function makeExecution(overrides: Partial<ExecutionRecord>): ExecutionRecord {
  return {
    id: 'exec-1',
    execution_type: 'workflow',
    source_id: 'wf-1',
    source_name: 'Test Workflow',
    status: 'success',
    trigger: 'manual',
    input_data: {},
    output_data: {},
    error: null,
    error_stack: null,
    steps: [],
    started_at: '2026-04-08T10:00:00Z',
    completed_at: '2026-04-08T10:00:05Z',
    duration_ms: 5000,
    tokens_used: 1000,
    cost_brl: 0.05,
    retry_of: null,
    parent_execution_id: null,
    tags: [],
    created_by: null,
    ...overrides,
  };
}

// ──────── compareExecutions ────────

describe('executionHistoryService — compareExecutions', () => {
  it('calculates duration diff correctly', () => {
    const a = makeExecution({ id: 'a', duration_ms: 5000 });
    const b = makeExecution({ id: 'b', duration_ms: 3000 });
    const result = compareExecutions(a, b);
    expect(result.duration_diff_ms).toBe(-2000); // b - a
  });

  it('calculates duration diff percentage', () => {
    const a = makeExecution({ id: 'a', duration_ms: 5000 });
    const b = makeExecution({ id: 'b', duration_ms: 7500 });
    const result = compareExecutions(a, b);
    expect(result.duration_diff_pct).toBe(50); // (2500/5000)*100
  });

  it('handles zero duration_ms in percentage calc', () => {
    const a = makeExecution({ id: 'a', duration_ms: 0 });
    const b = makeExecution({ id: 'b', duration_ms: 1000 });
    const result = compareExecutions(a, b);
    expect(result.duration_diff_pct).toBe(0); // avoid division by zero
  });

  it('handles null duration_ms as 0', () => {
    const a = makeExecution({ id: 'a', duration_ms: null });
    const b = makeExecution({ id: 'b', duration_ms: 2000 });
    const result = compareExecutions(a, b);
    expect(result.duration_diff_ms).toBe(2000);
  });

  it('calculates token diff', () => {
    const a = makeExecution({ id: 'a', tokens_used: 500 });
    const b = makeExecution({ id: 'b', tokens_used: 800 });
    expect(compareExecutions(a, b).token_diff).toBe(300);
  });

  it('calculates cost diff', () => {
    const a = makeExecution({ id: 'a', cost_brl: 0.1 });
    const b = makeExecution({ id: 'b', cost_brl: 0.25 });
    expect(compareExecutions(a, b).cost_diff_brl).toBeCloseTo(0.15);
  });

  it('status_match is true when both have same status', () => {
    const a = makeExecution({ id: 'a', status: 'success' });
    const b = makeExecution({ id: 'b', status: 'success' });
    expect(compareExecutions(a, b).status_match).toBe(true);
  });

  it('status_match is false when statuses differ', () => {
    const a = makeExecution({ id: 'a', status: 'success' });
    const b = makeExecution({ id: 'b', status: 'failed' });
    expect(compareExecutions(a, b).status_match).toBe(false);
  });

  it('compares steps by step_name', () => {
    const a = makeExecution({
      id: 'a',
      steps: [
        {
          step_id: 's1',
          step_name: 'fetch',
          step_type: 'action',
          status: 'success',
          input: {},
          output: {},
          error: null,
          started_at: '',
          completed_at: '',
          duration_ms: 100,
        },
        {
          step_id: 's2',
          step_name: 'process',
          step_type: 'action',
          status: 'success',
          input: {},
          output: {},
          error: null,
          started_at: '',
          completed_at: '',
          duration_ms: 200,
        },
      ],
    });
    const b = makeExecution({
      id: 'b',
      steps: [
        {
          step_id: 's1',
          step_name: 'fetch',
          step_type: 'action',
          status: 'success',
          input: {},
          output: {},
          error: null,
          started_at: '',
          completed_at: '',
          duration_ms: 150,
        },
        {
          step_id: 's2',
          step_name: 'process',
          step_type: 'action',
          status: 'failed',
          input: {},
          output: null,
          error: 'timeout',
          started_at: '',
          completed_at: '',
          duration_ms: 500,
        },
      ],
    });

    const result = compareExecutions(a, b);
    expect(result.step_diffs).toHaveLength(2);
    expect(result.step_diffs[0].step_name).toBe('fetch');
    expect(result.step_diffs[0].diff_ms).toBe(50); // 150 - 100
    expect(result.step_diffs[1].step_name).toBe('process');
    expect(result.step_diffs[1].a_status).toBe('success');
    expect(result.step_diffs[1].b_status).toBe('failed');
  });

  it('handles missing steps in execution b', () => {
    const a = makeExecution({
      id: 'a',
      steps: [
        {
          step_id: 's1',
          step_name: 'only-in-a',
          step_type: 'action',
          status: 'success',
          input: {},
          output: {},
          error: null,
          started_at: '',
          completed_at: '',
          duration_ms: 100,
        },
      ],
    });
    const b = makeExecution({ id: 'b', steps: [] });

    const result = compareExecutions(a, b);
    expect(result.step_diffs).toHaveLength(1);
    expect(result.step_diffs[0].b_duration_ms).toBeNull();
    expect(result.step_diffs[0].b_status).toBe('cancelled');
  });

  it('includes original execution references', () => {
    const a = makeExecution({ id: 'exec-a' });
    const b = makeExecution({ id: 'exec-b' });
    const result = compareExecutions(a, b);
    expect(result.execution_a.id).toBe('exec-a');
    expect(result.execution_b.id).toBe('exec-b');
  });
});
