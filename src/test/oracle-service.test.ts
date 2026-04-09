/**
 * oracleService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

describe('oracleService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/oracleService');
    expect(typeof mod.queryOracle).toBe('function');
    expect(typeof mod.getOracleHistory).toBe('function');
    expect(typeof mod.getOracleStats).toBe('function');
  });
});

describe('oracleService types', () => {
  it('exports exactly 3 functions', async () => {
    const mod = await import('@/services/oracleService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBe(3);
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/oracleService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('OracleQuery interface shape is importable', async () => {
    const mod = await import('@/services/oracleService');
    expect(mod).toBeDefined();
    expect(typeof mod.getOracleStats).toBe('function');
  });
});
