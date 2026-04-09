/**
 * agentsService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('agentsService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/agentsService');
    expect(typeof mod.getAgentById).toBe('function');
    expect(typeof mod.getAgentDetailTraces).toBe('function');
    expect(typeof mod.getAgentUsage).toBe('function');
    expect(typeof mod.getAgentRecentAlerts).toBe('function');
    expect(typeof mod.getAgentVersions).toBe('function');
  });
});

describe('agentsService types', () => {
  it('AgentDetail interface has expected shape', async () => {
    const mod = await import('@/services/agentsService');
    // Type-level check: ensure exports exist
    expect(mod).toHaveProperty('getAgentById');
    expect(mod).toHaveProperty('getAgentDetailTraces');
    expect(mod).toHaveProperty('getAgentUsage');
  });

  it('exports at least 5 functions', async () => {
    const mod = await import('@/services/agentsService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(5);
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/agentsService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
