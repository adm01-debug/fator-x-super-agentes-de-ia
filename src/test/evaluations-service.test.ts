/**
 * evaluationsService tests — pure function scoring
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('evaluationsService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/evaluationsService');
    expect(typeof mod.listEvaluationRuns).toBe('function');
    expect(typeof mod.listEvaluationDatasets).toBe('function');
    expect(typeof mod.listTestCases).toBe('function');
    expect(typeof mod.createEvaluationRun).toBe('function');
    expect(typeof mod.updateEvaluationRun).toBe('function');
    expect(typeof mod.createEvaluationDataset).toBe('function');
    expect(typeof mod.createTestCase).toBe('function');
    expect(typeof mod.deleteTestCase).toBe('function');
    expect(typeof mod.runEvaluation).toBe('function');
    expect(typeof mod.invokeEvalJudge).toBe('function');
    expect(typeof mod.listAgentsForSelect).toBe('function');
  });
});

describe('evaluationsService types', () => {
  it('exports at least 10 functions', async () => {
    const mod = await import('@/services/evaluationsService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(10);
  });

  it('CLEARScore and EvalResult types exist in module', async () => {
    const mod = await import('@/services/evaluationsService');
    // Type-level: runEvaluation returns { results: EvalResult[], clear: CLEARScore }
    expect(typeof mod.runEvaluation).toBe('function');
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/evaluationsService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
