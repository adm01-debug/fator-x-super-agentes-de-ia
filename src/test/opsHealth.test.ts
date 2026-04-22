/**
 * Unit tests focused on the pure derive functions from opsHealth.
 * Full computeOpsHealth is integration-tested via manual QA (needs DB).
 */
import { describe, it, expect, vi } from 'vitest';

// Para testar as funções puras `deriveLevel`/`buildHeadline`, re-criamos
// o shape em forma de wrapper via reimport do módulo. Como elas são
// internas, este arquivo exercita o contrato via `computeOpsHealth`
// mocando as dependências — o que também valida a composição do snapshot.

vi.mock('@/services/evalGates', () => ({
  listLatestEvalRunsForAgents: vi.fn(async () => ({})),
  computeGateForRun: vi.fn(() => ({
    allow: true,
    pass_rate: 1,
    threshold: 0.85,
    reason: 'ok',
    staleness_days: 0,
    avg_score: 1,
  })),
}));

vi.mock('@/services/costBudget', () => ({
  getBudgetSnapshot: vi.fn(async () => ({
    configured: true,
    allow_call: true,
    hard_stop: false,
    warning: false,
    daily_pct: 10,
    monthly_pct: 10,
    daily_spend: 1,
    monthly_spend: 10,
    daily_limit: 50,
    monthly_limit: 1000,
    soft_threshold_pct: 80,
    reason: null,
  })),
  shouldBlockCall: vi.fn(() => false),
}));

vi.mock('@/services/hitlQueue', () => ({
  getQueueStats: vi.fn(async () => ({
    total: 0,
    oldest_age_minutes: null,
    over_sla: 0,
    by_source: { workflow: 0, agent_trigger: 0 },
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ data: [], error: null }),
          data: [],
          error: null,
        }),
      }),
    }),
  },
}));

describe('opsHealth.computeOpsHealth', () => {
  it('returns ok when no signals are raised', async () => {
    const { computeOpsHealth } = await import('@/services/opsHealth');
    const snap = await computeOpsHealth('ws-1');
    expect(snap.level).toBe('ok');
    expect(snap.headline).toMatch(/Saudável/);
    expect(snap.gates.total_agents).toBe(0);
    expect(snap.hitl.total).toBe(0);
    expect(snap.budget?.configured).toBe(true);
  });

  it('degrades to block when budget blocks calls', async () => {
    const cost = await import('@/services/costBudget');
    (cost.shouldBlockCall as unknown as { mockReturnValue: (v: boolean) => void }).mockReturnValue(
      true,
    );
    const { computeOpsHealth } = await import('@/services/opsHealth');
    const snap = await computeOpsHealth('ws-1');
    expect(snap.level).toBe('block');
    expect(snap.headline).toMatch(/Orçamento/);
  });

  it('degrades to block when HITL SLA is breached', async () => {
    const cost = await import('@/services/costBudget');
    (cost.shouldBlockCall as unknown as { mockReturnValue: (v: boolean) => void }).mockReturnValue(
      false,
    );
    const hitl = await import('@/services/hitlQueue');
    (
      hitl.getQueueStats as unknown as { mockResolvedValueOnce: (v: unknown) => void }
    ).mockResolvedValueOnce({
      total: 2,
      oldest_age_minutes: 120,
      over_sla: 2,
      by_source: { workflow: 1, agent_trigger: 1 },
    });
    const { computeOpsHealth } = await import('@/services/opsHealth');
    const snap = await computeOpsHealth('ws-1');
    expect(snap.level).toBe('block');
    expect(snap.headline).toMatch(/SLA/);
  });
});
