import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockRejectedValue(new Error('unavailable')) },
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

describe('modelRouterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routeQuery falls back to local heuristic', async () => {
    const { routeQuery } = await import('@/services/modelRouterService');
    const result = await routeQuery('Hello world');
    expect(result).toHaveProperty('recommended_model');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('complexity');
    expect(result).toHaveProperty('alternatives');
  });

  it('routes simple queries to fast tier', async () => {
    const { routeQuery } = await import('@/services/modelRouterService');
    const result = await routeQuery('Olá');
    expect(result.tier).toBe('fast');
  });

  it('routes complex queries to higher tier', async () => {
    const { routeQuery } = await import('@/services/modelRouterService');
    const longQuery = 'Analise e compare os seguintes dados estatísticos, calcule o percentual de crescimento e explique por que houve variação. ' + 'x'.repeat(2500);
    const result = await routeQuery(longQuery);
    expect(['balanced', 'premium']).toContain(result.tier);
  });

  it('respects preferred provider', async () => {
    const { routeQuery } = await import('@/services/modelRouterService');
    const result = await routeQuery('test', 'claude');
    expect(result.recommended_model).toContain('claude');
  });

  it('returns alternatives excluding selected model', async () => {
    const { routeQuery } = await import('@/services/modelRouterService');
    const result = await routeQuery('test');
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.every(a => a.model !== result.recommended_model)).toBe(true);
  });
});
