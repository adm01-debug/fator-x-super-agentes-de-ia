import { describe, it, expect } from 'vitest';
import { enrichWithRagas } from '@/services/evaluationsService';
import type { EvalResult } from '@/services/types/evaluationsTypes';

function baseResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    test_case_id: 'tc-1',
    input: 'Qual o prazo de entrega da caneca branca?',
    expected: 'Prazo padrão da caneca branca é 12 dias úteis.',
    actual: 'Prazo padrão da caneca branca é 12 dias úteis.',
    scores: { deterministic: 1, statistical: 1, llm_judge: 1, combined: 1 },
    latency_ms: 100,
    tokens_used: 50,
    cost_usd: 0.001,
    status: 'pass',
    ...overrides,
  };
}

describe('evaluationsService.enrichWithRagas', () => {
  it('adds ragas scores when contexts are provided', () => {
    const enriched = enrichWithRagas(baseResult(), [
      'Caneca branca tem prazo padrão de 12 dias úteis.',
    ]);
    expect(enriched.ragas).toBeTruthy();
    expect(enriched.ragas!.faithfulness).toBeGreaterThan(0);
    expect(enriched.ragas!.overall).toBeGreaterThan(0);
  });

  it('leaves result untouched when contexts is empty', () => {
    const r = baseResult();
    const enriched = enrichWithRagas(r, []);
    expect(enriched).toBe(r);
    expect(enriched.ragas).toBeUndefined();
  });

  it('uses ground_truth override when provided', () => {
    const enriched = enrichWithRagas(
      baseResult(),
      ['doze dias úteis é o prazo padrão'],
      'doze dias úteis padrão canecas',
    );
    expect(enriched.ragas?.context_recall).not.toBeNull();
  });
});
