import { describe, it, expect } from 'vitest';
import {
  tokenize,
  faithfulness,
  answerRelevancy,
  contextPrecision,
  contextRecall,
  scoreRagas,
  evaluateRagas,
  DEFAULT_RAGAS_THRESHOLDS,
} from '@/lib/ragas';

describe('ragas.tokenize', () => {
  it('lowercases and strips stopwords', () => {
    expect(tokenize('A caneca é branca')).toEqual(['caneca', 'branca']);
  });

  it('strips diacritics', () => {
    const t = tokenize('ação gráfica');
    expect(t).toContain('acao');
    expect(t).toContain('grafica');
  });

  it('ignores punctuation and short tokens', () => {
    expect(tokenize('I, O, and: xyz!!!')).toEqual(['xyz']);
  });
});

describe('ragas.faithfulness', () => {
  it('returns high score when answer is fully grounded in contexts', () => {
    const score = faithfulness('A caneca térmica branca leva 12 dias úteis para gravação laser.', [
      'Caneca térmica branca tem prazo padrão de 12 dias úteis.',
      'Gravação laser é o método mais durável para canecas.',
    ]);
    expect(score).toBeGreaterThan(0.3);
  });

  it('returns 0 when contexts are empty', () => {
    expect(faithfulness('qualquer resposta', [])).toBe(0);
  });

  it('returns 0 when answer is empty', () => {
    expect(faithfulness('', ['algum contexto'])).toBe(0);
  });
});

describe('ragas.answerRelevancy', () => {
  it('is high when answer mentions question keywords', () => {
    const s = answerRelevancy(
      'Qual o prazo de entrega da caneca branca?',
      'O prazo de entrega da caneca branca é 12 dias úteis.',
    );
    expect(s).toBeGreaterThan(0.3);
  });

  it('is low when answer is off-topic', () => {
    const s = answerRelevancy(
      'Qual o prazo de entrega da caneca?',
      'Camisetas pretas custam R$25.',
    );
    expect(s).toBeLessThan(0.1);
  });
});

describe('ragas.contextPrecision', () => {
  it('is 1 when every chunk matches the question', () => {
    const s = contextPrecision('caneca térmica', ['caneca térmica branca', 'caneca térmica preta']);
    expect(s).toBe(1);
  });

  it('is 0 when no chunk matches', () => {
    const s = contextPrecision('caneca', ['camiseta branca', 'boné azul']);
    expect(s).toBe(0);
  });
});

describe('ragas.contextRecall', () => {
  it('returns Jaccard against the union of contexts', () => {
    const s = contextRecall('caneca branca 12 dias', ['caneca branca', '12 dias úteis']);
    expect(s).toBeGreaterThan(0.3);
  });

  it('returns 0 with empty contexts', () => {
    expect(contextRecall('algo', [])).toBe(0);
  });
});

describe('ragas.scoreRagas', () => {
  it('aggregates 4 metrics when ground_truth provided', () => {
    const scores = scoreRagas({
      question: 'Qual prazo da caneca branca?',
      answer: 'Prazo padrão da caneca branca é 12 dias úteis.',
      contexts: ['Caneca branca: 12 dias úteis para gravação laser.'],
      ground_truth: '12 dias úteis para caneca branca.',
    });
    expect(scores.context_recall).not.toBeNull();
    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.overall).toBeLessThanOrEqual(1);
  });

  it('omits context_recall when ground_truth missing', () => {
    const scores = scoreRagas({
      question: 'Qual prazo?',
      answer: 'Doze dias.',
      contexts: ['doze dias úteis'],
    });
    expect(scores.context_recall).toBeNull();
  });
});

describe('ragas.evaluateRagas', () => {
  it('passes when all metrics clear defaults', () => {
    const verdict = evaluateRagas({
      question: 'Qual prazo da caneca branca?',
      answer: 'Prazo padrão da caneca branca é 12 dias úteis.',
      contexts: ['Caneca branca tem prazo 12 dias úteis.'],
      ground_truth: 'Caneca branca 12 dias úteis.',
    });
    expect(verdict.passes).toBe(true);
    expect(verdict.failures).toHaveLength(0);
  });

  it('reports exact failing metrics', () => {
    const verdict = evaluateRagas({
      question: 'Qual a cor?',
      answer: 'Não sei.',
      contexts: ['nada relevante aqui'],
    });
    expect(verdict.passes).toBe(false);
    expect(verdict.failures.length).toBeGreaterThan(0);
  });

  it('uses custom thresholds', () => {
    const verdict = evaluateRagas(
      {
        question: 'x',
        answer: 'y',
        contexts: ['z'],
      },
      { faithfulness: 0 }, // desabilita esse corte
    );
    expect(verdict.failures).not.toContain('faithfulness');
  });

  it('exposes default thresholds', () => {
    expect(DEFAULT_RAGAS_THRESHOLDS.faithfulness).toBeGreaterThan(0);
  });
});
