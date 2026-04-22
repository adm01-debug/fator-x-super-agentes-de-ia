import { describe, it, expect } from 'vitest';
import {
  estimateSplit,
  hashFNV1a,
  hashToUnitInterval,
  selectVariantForSession,
} from '@/lib/promptABRollout';

describe('promptABRollout.hashFNV1a', () => {
  it('is deterministic', () => {
    expect(hashFNV1a('abc')).toBe(hashFNV1a('abc'));
  });

  it('differs for different inputs', () => {
    expect(hashFNV1a('abc')).not.toBe(hashFNV1a('abd'));
  });

  it('is a 32-bit unsigned integer', () => {
    const h = hashFNV1a('some long-ish input 12345');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe('promptABRollout.hashToUnitInterval', () => {
  it('returns a number in [0, 1)', () => {
    for (const key of ['u1', 'u2', 'u3', 'session-xyz', 'abc@def.com']) {
      const u = hashToUnitInterval('exp-1', key);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('is deterministic per (experiment, session) pair', () => {
    expect(hashToUnitInterval('exp-1', 'u1')).toBe(hashToUnitInterval('exp-1', 'u1'));
  });

  it('differs across experiments for the same session', () => {
    expect(hashToUnitInterval('exp-1', 'u1')).not.toBe(hashToUnitInterval('exp-2', 'u1'));
  });
});

describe('promptABRollout.selectVariantForSession', () => {
  it('sticky — same input returns same variant', () => {
    const input = { experiment_id: 'exp-1', session_key: 'user-42', traffic_split: 0.5 };
    const first = selectVariantForSession(input);
    for (let i = 0; i < 100; i++) expect(selectVariantForSession(input)).toBe(first);
  });

  it('always returns A when split=0', () => {
    for (const key of ['a', 'b', 'c', 'd']) {
      expect(
        selectVariantForSession({ experiment_id: 'e', session_key: key, traffic_split: 0 }),
      ).toBe('a');
    }
  });

  it('always returns B when split=1', () => {
    for (const key of ['a', 'b', 'c', 'd']) {
      expect(
        selectVariantForSession({ experiment_id: 'e', session_key: key, traffic_split: 1 }),
      ).toBe('b');
    }
  });

  it('treats NaN / negative as 0 (variant A only)', () => {
    expect(
      selectVariantForSession({ experiment_id: 'e', session_key: 'x', traffic_split: -1 }),
    ).toBe('a');
    expect(
      selectVariantForSession({ experiment_id: 'e', session_key: 'x', traffic_split: NaN }),
    ).toBe('a');
  });
});

describe('promptABRollout.estimateSplit', () => {
  it('respects the target split within tolerance for large N', () => {
    const keys = Array.from({ length: 5000 }, (_, i) => `session-${i}`);
    const { pct_b } = estimateSplit('exp-large', keys, 0.3);
    expect(pct_b).toBeGreaterThan(0.27);
    expect(pct_b).toBeLessThan(0.33);
  });

  it('always returns 0 when empty list', () => {
    expect(estimateSplit('exp', [], 0.5).pct_b).toBe(0);
  });
});
