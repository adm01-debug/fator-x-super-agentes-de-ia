import { describe, it, expect } from 'vitest';
import {
  NoWorkspaceError,
  WORKSPACE_SCOPED_TABLES,
  isScopedTable,
  scopeQuery,
} from '@/lib/workspaceScope';

describe('workspaceScope.isScopedTable', () => {
  it('flags tables that carry workspace_id', () => {
    expect(isScopedTable('agents')).toBe(true);
    expect(isScopedTable('agent_eval_runs')).toBe(true);
    expect(isScopedTable('workflow_runs')).toBe(true);
  });

  it('returns false for unscoped tables', () => {
    expect(isScopedTable('profiles')).toBe(false);
    expect(isScopedTable('doesnt_exist')).toBe(false);
  });
});

describe('workspaceScope.WORKSPACE_SCOPED_TABLES', () => {
  it('exposes a non-empty set', () => {
    expect(WORKSPACE_SCOPED_TABLES.size).toBeGreaterThan(10);
  });

  it('includes tables critical for Rodada 1 features', () => {
    for (const tbl of [
      'agent_eval_runs',
      'workspace_budgets',
      'workflow_runs',
      'prompt_experiments',
    ]) {
      expect(WORKSPACE_SCOPED_TABLES.has(tbl)).toBe(true);
    }
  });
});

describe('workspaceScope.scopeQuery', () => {
  it('applies eq(workspace_id, ...) on a fluent builder', () => {
    const calls: Array<[string, unknown]> = [];
    const builder = {
      eq(col: string, value: unknown) {
        calls.push([col, value]);
        return this;
      },
    };
    scopeQuery(builder, 'ws-1');
    expect(calls).toEqual([['workspace_id', 'ws-1']]);
  });

  it('chains a second call idempotently (caller decides)', () => {
    const calls: Array<[string, unknown]> = [];
    const builder = {
      eq(col: string, value: unknown) {
        calls.push([col, value]);
        return this;
      },
    };
    scopeQuery(builder, 'ws-1').eq('status', 'active');
    expect(calls).toEqual([
      ['workspace_id', 'ws-1'],
      ['status', 'active'],
    ]);
  });
});

describe('workspaceScope.NoWorkspaceError', () => {
  it('carries a clear message', () => {
    const err = new NoWorkspaceError();
    expect(err.name).toBe('NoWorkspaceError');
    expect(err.message).toMatch(/workspace/i);
  });
});
