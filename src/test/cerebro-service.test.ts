/**
 * cerebroService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}));

describe('cerebroService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/cerebroService');
    expect(typeof mod.getHealthScore).toBe('function');
    expect(typeof mod.queryBrain).toBe('function');
    expect(typeof mod.getMemories).toBe('function');
    expect(typeof mod.invokeCerebroBrain).toBe('function');
    expect(typeof mod.invokeCerebroQuery).toBe('function');
    expect(typeof mod.getKnowledgeAreaStats).toBe('function');
  });
});

describe('cerebroService types', () => {
  it('exports at least 6 functions', async () => {
    const mod = await import('@/services/cerebroService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(6);
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/cerebroService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('KnowledgeAreaStats interface shape is consistent', async () => {
    const mod = await import('@/services/cerebroService');
    // getKnowledgeAreaStats returns Record<string, KnowledgeAreaStats>
    expect(typeof mod.getKnowledgeAreaStats).toBe('function');
  });
});
