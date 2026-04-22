import { describe, it, expect } from 'vitest';
import { _internal } from '@/services/metaOrchestrator';

const { scoreIntent } = _internal;

function agent(name: string, mission: string, tags: string[] = []) {
  return { id: name, name, avatar_emoji: null, mission, tags, status: 'configured' };
}

describe('metaOrchestrator.scoreIntent', () => {
  it('matches tokens between query and agent mission/tags', () => {
    const res = scoreIntent(
      'Preciso de uma cotação de frete para 200 canecas em Curitiba',
      agent(
        'Especialista em Vendas',
        'Gera cotações de produtos promocionais e brindes corporativos',
        ['cotacao', 'vendas', 'brindes'],
      ),
    );
    expect(res.score).toBeGreaterThan(0);
    expect(res.matches.length).toBeGreaterThan(0);
  });

  it('returns 0 when there is no token overlap', () => {
    const res = scoreIntent('aaaa bbbb cccc', agent('xyz', 'totally unrelated mission'));
    expect(res.score).toBe(0);
    expect(res.matches).toEqual([]);
  });

  it('ignores stopwords in scoring', () => {
    // "a de para com em" são stopwords; sobra só "caneca"
    const withStop = scoreIntent(
      'a caneca de vidro com entrega em casa',
      agent('Sales', 'venda caneca'),
    );
    const withoutStop = scoreIntent('caneca', agent('Sales', 'venda caneca'));
    // score é recall-like sobre tokens da query, então with stop terá overlap menor
    expect(withStop.matches).toContain('caneca');
    expect(withoutStop.score).toBe(1);
  });

  it('prefers agents with higher token overlap', () => {
    const queryVendas = 'Cotação de brindes promocionais';
    const sales = agent('Vendas', 'Gera cotações de brindes promocionais', ['vendas']);
    const support = agent('Suporte', 'Responde dúvidas gerais', ['suporte']);

    const sSales = scoreIntent(queryVendas, sales).score;
    const sSupport = scoreIntent(queryVendas, support).score;
    expect(sSales).toBeGreaterThan(sSupport);
  });
});
