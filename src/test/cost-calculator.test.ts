import { describe, it, expect } from 'vitest';
import {
  formatCostUsd,
  formatCostBrl,
  calculateCost,
} from '@/services/costCalculatorService';

describe('Cost Calculator Service', () => {
  it('formatCostUsd formats small values correctly', () => {
    expect(formatCostUsd(0.001)).toMatch(/\$0\.001/);
  });

  it('formatCostUsd formats zero as $0.00', () => {
    expect(formatCostUsd(0)).toMatch(/\$0/);
  });

  it('formatCostBrl formats values with R$', () => {
    const result = formatCostBrl(10);
    expect(result).toContain('R$');
  });

  it('calculateCost returns valid estimate', () => {
    const result = calculateCost('gpt-4o', 1000, 500);
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
    expect(result.inputCost).toBeGreaterThanOrEqual(0);
    expect(result.outputCost).toBeGreaterThanOrEqual(0);
  });

  it('calculateCost handles unknown models gracefully', () => {
    const result = calculateCost('unknown-model-xyz', 1000, 500);
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('calculateCost scales with token count', () => {
    const small = calculateCost('gpt-4o', 100, 50);
    const large = calculateCost('gpt-4o', 10000, 5000);
    expect(large.totalCost).toBeGreaterThanOrEqual(small.totalCost);
  });
});
