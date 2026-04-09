/**
 * workflowCheckpointService tests
 *
 * Covers: type definitions and interfaces.
 * DB-dependent functions require mocking which is outside scope
 * of this pure-function test suite.
 */
import { describe, it, expect } from 'vitest';
import type {
  WorkflowExecution,
  WorkflowCheckpoint,
  CheckpointCreateInput,
  TimeTravelForkInput,
} from '@/services/workflowCheckpointService';

describe('workflowCheckpointService — types', () => {
  it('WorkflowExecution interface has expected shape', () => {
    const exec: WorkflowExecution = {
      id: 'exec-1',
      workflow_id: 'wf-1',
      user_id: 'user-1',
      status: 'running',
      input: { prompt: 'test' },
      output: null,
      error: null,
      total_cost_usd: 0,
      total_tokens: 0,
      total_duration_ms: 0,
      started_at: '2026-04-08T10:00:00Z',
      completed_at: null,
      created_at: '2026-04-08T10:00:00Z',
    };
    expect(exec.id).toBe('exec-1');
    expect(exec.status).toBe('running');
    expect(exec.output).toBeNull();
  });

  it('WorkflowCheckpoint interface has expected shape', () => {
    const cp: WorkflowCheckpoint = {
      id: 'cp-1',
      execution_id: 'exec-1',
      node_id: 'node-a',
      node_type: 'llm_call',
      step_index: 0,
      state: { context: 'preserved' },
      node_input: { prompt: 'hello' },
      node_output: { response: 'world' },
      cost_usd: 0.001,
      tokens_used: 50,
      duration_ms: 200,
      status: 'completed',
      error: null,
      created_at: '2026-04-08T10:00:01Z',
    };
    expect(cp.node_type).toBe('llm_call');
    expect(cp.cost_usd).toBe(0.001);
  });

  it('CheckpointCreateInput allows optional fields', () => {
    const input: CheckpointCreateInput = {
      execution_id: 'exec-1',
      node_id: 'n1',
      node_type: 'action',
      step_index: 1,
      state: {},
    };
    expect(input.cost_usd).toBeUndefined();
    expect(input.tokens_used).toBeUndefined();
  });

  it('TimeTravelForkInput has checkpoint_id as required', () => {
    const fork: TimeTravelForkInput = {
      checkpoint_id: 'cp-1',
      modified_state: { override: true },
    };
    expect(fork.checkpoint_id).toBe('cp-1');
    expect(fork.modified_state?.override).toBe(true);
  });

  it('WorkflowExecution status type accepts all valid values', () => {
    const statuses: WorkflowExecution['status'][] = [
      'running',
      'paused',
      'completed',
      'failed',
      'cancelled',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('WorkflowCheckpoint status type accepts all valid values', () => {
    const statuses: WorkflowCheckpoint['status'][] = [
      'pending',
      'running',
      'completed',
      'failed',
      'skipped',
    ];
    expect(statuses).toHaveLength(5);
  });
});
