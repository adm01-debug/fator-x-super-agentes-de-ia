/**
 * costCalculatorService tests (next-frontier coverage expansion #1)
 *
 * Targets: pure function service, ~266 lines, 0% → ~85% coverage.
 * Covers: pricing lookup, cost calculation, workflow estimation,
 * budget checks, formatting helpers, cost comparison.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getModelPricing,
  getAllPricing,
  setExchangeRate,
  getExchangeRate,
  calculateCost,
  estimateWorkflowCost,
  setBudget,
  getBudget,
  checkRequestBudget,
  calculateBudgetStatus,
  formatCostUsd,
  formatCostBrl,
  formatTokenCount,
  compareCosts,
} from '@/services/costCalculatorService';

describe('costCalculatorService — pricing lookup', () => {
  it('getAllPricing returns a non-empty array', () => {
    const all = getAllPricing();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('getAllPricing returns a copy (caller mutation does not affect db)', () => {
    const a = getAllPricing();
    const before = a.length;
    a.push({} as never);
    const b = getAllPricing();
    expect(b.length).toBe(before);
  });

  it('getModelPricing returns null for unknown provider', () => {
    expect(getModelPricing('unknown-provider', 'gpt-5')).toBeNull();
  });

  it('getModelPricing finds via partial match', () => {
    const all = getAllPricing();
    if (all.length > 0) {
      const sample = all[0];
      // Append suffix - partial match should still find it
      const found = getModelPricing(sample.provider, sample.model + '-extra');
      expect(found).not.toBeNull();
      expect(found?.provider).toBe(sample.provider);
    }
  });
});

describe('costCalculatorService — exchange rate', () => {
  beforeEach(() => {
    setExchangeRate(5.0);
  });

  it('getExchangeRate returns the current rate', () => {
    expect(getExchangeRate()).toBe(5.0);
  });

  it('setExchangeRate updates the value', () => {
    setExchangeRate(5.5);
    expect(getExchangeRate()).toBe(5.5);
  });
});

describe('costCalculatorService — calculateCost', () => {
  beforeEach(() => setExchangeRate(5.0));

  it('throws when token counts are negative', () => {
    expect(() => calculateCost('anthropic', 'sonnet', -1, 100)).toThrow(/non-negative/);
    expect(() => calculateCost('anthropic', 'sonnet', 100, -1)).toThrow(/non-negative/);
  });

  it('throws when provider is empty', () => {
    expect(() => calculateCost('', 'sonnet', 100, 100)).toThrow(/required/);
  });

  it('throws when model is empty', () => {
    expect(() => calculateCost('anthropic', '', 100, 100)).toThrow(/required/);
  });

  it('returns zero cost for zero tokens', () => {
    const c = calculateCost('anthropic', 'sonnet', 0, 0);
    expect(c.inputCostUsd).toBe(0);
    expect(c.outputCostUsd).toBe(0);
    expect(c.totalCostUsd).toBe(0);
    expect(c.totalCostBrl).toBe(0);
  });

  it('returns proportional cost for non-zero tokens (default rates)', () => {
    const c = calculateCost('unknown-provider', 'unknown-model', 1_000_000, 0);
    // Default input rate is 3.0/M, so 1M tokens = $3
    expect(c.inputCostUsd).toBe(3.0);
    expect(c.outputCostUsd).toBe(0);
    expect(c.totalCostUsd).toBe(3.0);
  });

  it('output rate is 5x input rate at default (Sonnet-shaped)', () => {
    const c = calculateCost('unknown-provider', 'unknown-model', 0, 1_000_000);
    expect(c.outputCostUsd).toBe(15.0);
  });

  it('totalCostBrl applies the exchange rate', () => {
    setExchangeRate(6.0);
    const c = calculateCost('unknown-provider', 'unknown-model', 1_000_000, 0);
    expect(c.totalCostBrl).toBe(18.0); // 3 USD × 6
  });

  it('returns ActualCost shape with all required fields', () => {
    const c = calculateCost('anthropic', 'sonnet', 100, 50);
    expect(c).toHaveProperty('inputTokens', 100);
    expect(c).toHaveProperty('outputTokens', 50);
    expect(c).toHaveProperty('totalTokens', 150);
    expect(c).toHaveProperty('inputCostUsd');
    expect(c).toHaveProperty('outputCostUsd');
    expect(c).toHaveProperty('totalCostUsd');
    expect(c).toHaveProperty('totalCostBrl');
    expect(c).toHaveProperty('provider', 'anthropic');
    expect(c).toHaveProperty('model', 'sonnet');
    expect(c).toHaveProperty('timestamp');
  });
});

describe('costCalculatorService — estimateWorkflowCost', () => {
  it('returns zero for empty node array', () => {
    const e = estimateWorkflowCost([], 'anthropic', 'sonnet');
    expect(e.estimatedInputTokens).toBe(0);
    expect(e.estimatedOutputTokens).toBe(0);
    expect(e.totalCostUsd).toBe(0);
  });

  it('estimates a single node', () => {
    const e = estimateWorkflowCost(
      [{ id: 'n1', type: 'agent', data: {} }],
      'anthropic',
      'sonnet'
    );
    expect(e.estimatedInputTokens).toBeGreaterThan(0);
    expect(e.totalCostUsd).toBeGreaterThan(0);
    expect(Array.isArray(e.breakdown)).toBe(true);
  });

  it('breakdown has one entry per node', () => {
    const nodes = [
      { id: 'n1', type: 'agent', data: {} },
      { id: 'n2', type: 'tool', data: {} },
      { id: 'n3', type: 'rag', data: {} },
    ];
    const e = estimateWorkflowCost(nodes, 'anthropic', 'sonnet');
    expect(e.breakdown?.length).toBe(3);
  });

  it('respects per-node provider/model overrides in node.data', () => {
    const nodes = [
      { id: 'n1', type: 'agent', data: { provider: 'openai', model: 'gpt-4' } },
    ];
    const e = estimateWorkflowCost(nodes, 'anthropic', 'sonnet');
    expect(e.breakdown?.[0].provider).toBe('openai');
    expect(e.breakdown?.[0].model).toBe('gpt-4');
  });

  it('returns a confidence level', () => {
    const e = estimateWorkflowCost(
      [{ id: 'n1', type: 'agent', data: {} }],
      'anthropic',
      'sonnet'
    );
    expect(['low', 'medium', 'high']).toContain(e.confidence);
  });
});

describe('costCalculatorService — budget config', () => {
  beforeEach(() => {
    // Reset budget to known values
    setBudget({
      maxCostPerRequestUsd: 1.0,
      maxCostPerDayUsd: 50.0,
      maxCostPerMonthUsd: 1000.0,
      alertThresholdPercent: 80,
    });
  });

  it('setBudget returns the merged config', () => {
    const updated = setBudget({ maxCostPerRequestUsd: 2.0 });
    expect(updated.maxCostPerRequestUsd).toBe(2.0);
    expect(updated.maxCostPerDayUsd).toBe(50.0); // unchanged
  });

  it('getBudget returns a copy', () => {
    const b = getBudget();
    b.maxCostPerRequestUsd = 999;
    const b2 = getBudget();
    expect(b2.maxCostPerRequestUsd).toBe(1.0); // not 999
  });

  it('checkRequestBudget allows under-limit cost', () => {
    const r = checkRequestBudget(0.5);
    expect(r.allowed).toBe(true);
    expect(r.overage).toBe(0);
  });

  it('checkRequestBudget rejects over-limit cost', () => {
    const r = checkRequestBudget(1.5);
    expect(r.allowed).toBe(false);
    expect(r.overage).toBeCloseTo(0.5, 6);
    expect(r.maxAllowed).toBe(1.0);
    expect(r.estimated).toBe(1.5);
  });

  it('checkRequestBudget allows exactly at limit', () => {
    const r = checkRequestBudget(1.0);
    expect(r.allowed).toBe(true);
  });
});

describe('costCalculatorService — calculateBudgetStatus', () => {
  beforeEach(() => {
    setBudget({
      maxCostPerRequestUsd: 1.0,
      maxCostPerDayUsd: 100.0,
      maxCostPerMonthUsd: 2000.0,
      alertThresholdPercent: 80,
    });
  });

  it('reports zero spending correctly', () => {
    const s = calculateBudgetStatus(0, 0);
    expect(s.dailyPercent).toBe(0);
    expect(s.monthlyPercent).toBe(0);
    expect(s.isOverDailyBudget).toBe(false);
    expect(s.shouldAlert).toBe(false);
  });

  it('flags shouldAlert when daily reaches threshold', () => {
    const s = calculateBudgetStatus(80, 0); // 80% of 100
    expect(s.dailyPercent).toBe(80);
    expect(s.shouldAlert).toBe(true);
    expect(s.isOverDailyBudget).toBe(false);
  });

  it('flags isOverDailyBudget when daily > limit', () => {
    const s = calculateBudgetStatus(150, 0);
    expect(s.isOverDailyBudget).toBe(true);
    expect(s.shouldAlert).toBe(true);
  });

  it('flags isOverMonthlyBudget independently', () => {
    const s = calculateBudgetStatus(0, 2500);
    expect(s.isOverMonthlyBudget).toBe(true);
  });
});

describe('costCalculatorService — formatters', () => {
  it('formatCostUsd handles tiny amounts', () => {
    expect(formatCostUsd(0.0001)).toBe('$0.00');
    expect(formatCostUsd(0.005)).toBe('$0.0050');
    expect(formatCostUsd(0.1)).toBe('$0.100');
    expect(formatCostUsd(1.234)).toBe('$1.23');
    expect(formatCostUsd(100.5)).toBe('$100.50');
  });

  it('formatCostBrl applies exchange and uses comma', () => {
    setExchangeRate(5.0);
    expect(formatCostBrl(1.0)).toBe('R$ 5,00');
    expect(formatCostBrl(0.001)).toBe('R$ 0,00');
  });

  it('formatTokenCount uses K/M abbreviations', () => {
    expect(formatTokenCount(500)).toBe('500');
    expect(formatTokenCount(1500)).toBe('1.5K');
    expect(formatTokenCount(15_000)).toBe('15.0K');
    expect(formatTokenCount(2_500_000)).toBe('2.5M');
  });

  it('formatTokenCount handles zero', () => {
    expect(formatTokenCount(0)).toBe('0');
  });
});

describe('costCalculatorService — compareCosts', () => {
  it('returns one entry per pricing row', () => {
    const cmp = compareCosts(1000, 500);
    expect(cmp.length).toBe(getAllPricing().length);
  });

  it('is sorted ascending by cost', () => {
    const cmp = compareCosts(10000, 5000);
    for (let i = 1; i < cmp.length; i++) {
      expect(cmp[i].costUsd).toBeGreaterThanOrEqual(cmp[i - 1].costUsd);
    }
  });

  it('includes both USD and BRL costs', () => {
    const cmp = compareCosts(100, 50);
    cmp.forEach((entry) => {
      expect(entry).toHaveProperty('costUsd');
      expect(entry).toHaveProperty('costBrl');
      expect(entry).toHaveProperty('provider');
      expect(entry).toHaveProperty('model');
    });
  });

  it('zero tokens produces zero cost across all providers', () => {
    const cmp = compareCosts(0, 0);
    cmp.forEach((entry) => {
      expect(entry.costUsd).toBe(0);
      expect(entry.costBrl).toBe(0);
    });
  });
});
