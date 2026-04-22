import { describe, it, expect } from 'vitest';
import {
  isOverBudget,
  shouldBlockCall,
  toSnapshot,
  type BudgetSnapshot,
} from '@/services/costBudget';
import type { BudgetStatus } from '@/services/budgetService';

function makeStatus(overrides: Partial<BudgetStatus> = {}): BudgetStatus {
  return {
    allowed: true,
    configured: true,
    warning: false,
    hard_stop: false,
    reason: null,
    monthly_spend: 100,
    monthly_limit: 1000,
    monthly_pct: 10,
    daily_spend: 10,
    daily_limit: 100,
    daily_pct: 10,
    soft_threshold_pct: 80,
    ...overrides,
  };
}

describe('costBudget.toSnapshot', () => {
  it('extracts numeric defaults when fields missing', () => {
    const s = toSnapshot({ allowed: true, configured: false } as BudgetStatus);
    expect(s.daily_pct).toBe(0);
    expect(s.monthly_pct).toBe(0);
    expect(s.soft_threshold_pct).toBe(80);
    expect(s.configured).toBe(false);
  });

  it('marks warning when either pct crosses the soft threshold', () => {
    const s = toSnapshot(makeStatus({ monthly_pct: 85 }));
    expect(s.warning).toBe(true);
  });

  it('does not warn when both pct below threshold', () => {
    const s = toSnapshot(makeStatus({ monthly_pct: 50, daily_pct: 40 }));
    expect(s.warning).toBe(false);
  });
});

describe('costBudget.shouldBlockCall / isOverBudget', () => {
  it('allows calls when no budget is configured', () => {
    const s: BudgetSnapshot = toSnapshot(makeStatus({ configured: false, allowed: true }));
    expect(shouldBlockCall(s)).toBe(false);
  });

  it('blocks when hard_stop is true', () => {
    const s = toSnapshot(makeStatus({ hard_stop: true, allowed: false }));
    expect(shouldBlockCall(s)).toBe(true);
  });

  it('blocks when allowed is false even without explicit hard_stop', () => {
    const s = toSnapshot(makeStatus({ allowed: false }));
    expect(shouldBlockCall(s)).toBe(true);
  });

  it('isOverBudget triggers at ≥ 100%', () => {
    expect(isOverBudget(toSnapshot(makeStatus({ monthly_pct: 100 })))).toBe(true);
    expect(isOverBudget(toSnapshot(makeStatus({ daily_pct: 101 })))).toBe(true);
    expect(isOverBudget(toSnapshot(makeStatus({ monthly_pct: 99, daily_pct: 99 })))).toBe(false);
  });
});
