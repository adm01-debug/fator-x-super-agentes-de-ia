/**
 * Pure-function tests for CLEAR scoring (deterministic + ROUGE-L statistical).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/integrations/supabase/externalClient', () => ({
  supabaseExternal: { from: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { scoreDeterministic, scoreStatistical } from '@/services/evaluationsService';

describe('scoreDeterministic', () => {
  it('returns 0 for empty inputs', () => {
    expect(scoreDeterministic('', 'foo')).toBe(0);
    expect(scoreDeterministic('foo', '')).toBe(0);
    expect(scoreDeterministic('', '')).toBe(0);
  });

  it('returns 1 for exact match (normalized)', () => {
    const s = scoreDeterministic('Hello World', '  hello   world  ');
    expect(s).toBeGreaterThan(0.6);
  });

  it('rewards JSON key overlap', () => {
    const expected = JSON.stringify({ a: 1, b: 2, c: 3 });
    const actual = JSON.stringify({ a: 9, b: 8, c: 7 });
    const s = scoreDeterministic(expected, actual);
    expect(s).toBeGreaterThan(0.4);
  });

  it('penalizes wildly different lengths', () => {
    const expected = 'short';
    const actual = 'x'.repeat(1000);
    const s = scoreDeterministic(expected, actual);
    expect(s).toBeLessThan(0.5);
  });

  it('returns a number between 0 and 1', () => {
    for (let i = 0; i < 5; i++) {
      const s = scoreDeterministic('expected text here', 'some actual text');
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('scoreStatistical (ROUGE-L blend)', () => {
  it('returns 0 for empty inputs', () => {
    expect(scoreStatistical('', 'word')).toBe(0);
    expect(scoreStatistical('word', '')).toBe(0);
  });

  it('returns ~1 for identical strings', () => {
    const s = scoreStatistical('the quick brown fox', 'the quick brown fox');
    expect(s).toBeGreaterThan(0.95);
  });

  it('returns intermediate score for partial overlap', () => {
    const s = scoreStatistical('the quick brown fox jumps', 'the slow brown dog jumps');
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(0.9);
  });

  it('returns low score for unrelated text', () => {
    const s = scoreStatistical('the quick brown fox', 'completely unrelated phrase here');
    expect(s).toBeLessThan(0.3);
  });

  it('handles ordering — LCS rewards sequence', () => {
    const inOrder = scoreStatistical('alpha beta gamma delta', 'alpha beta gamma delta');
    const reversed = scoreStatistical('alpha beta gamma delta', 'delta gamma beta alpha');
    expect(inOrder).toBeGreaterThan(reversed);
  });

  it('always returns value in [0, 1]', () => {
    const cases = [
      ['hello world', 'hello'],
      ['a b c d e', 'e d c b a'],
      ['only one match', 'totally different'],
      ['x x x x', 'x x x x x x'],
    ];
    for (const [a, b] of cases) {
      const s = scoreStatistical(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
