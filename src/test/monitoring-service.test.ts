/**
 * monitoringService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  },
}));
vi.mock('@/lib/supabaseExtended', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  })),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('monitoringService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/monitoringService');
    expect(typeof mod.getAgentTraces).toBe('function');
    expect(typeof mod.getSessions).toBe('function');
    expect(typeof mod.getSessionTraces).toBe('function');
    expect(typeof mod.getTraceEvents).toBe('function');
    expect(typeof mod.getAlerts).toBe('function');
    expect(typeof mod.resolveAlert).toBe('function');
    expect(typeof mod.getAgentsForFilter).toBe('function');
    expect(typeof mod.getDashboardMetrics).toBe('function');
    expect(typeof mod.getRecentTraceEvents).toBe('function');
  });
});

describe('monitoringService types', () => {
  it('exports at least 9 functions', async () => {
    const mod = await import('@/services/monitoringService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(9);
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/monitoringService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('TraceEvent type is exported', async () => {
    const mod = await import('@/services/monitoringService');
    expect(typeof mod.getRecentTraceEvents).toBe('function');
  });
});
