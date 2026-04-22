import { describe, it } from 'vitest';
import { detectPromptContradictions } from '../promptContradictions';

const cases = [
  'Sempre responda em português.\nNunca responda em inglês.',
  'Responda em português.\nResponda em inglês.',
  '- Sempre cite as fontes do documento.\n- Nunca cite as fontes do documento.',
  '- Sempre confirme o pedido do cliente.\n- Nunca confirme o pedido do cliente.',
  'Responda com no máximo 100 palavras.\nResponda com pelo menos 200 palavras.',
  '- Sempre mencione o produto premium ao cliente.\n- Nunca mencione o produto premium ao cliente.',
];
describe('probe', () => {
  for (const [i, c] of cases.entries()) {
    it(`case ${i}`, () => {
      // eslint-disable-next-line no-console
      console.log('CASE', i, JSON.stringify(detectPromptContradictions(c)));
    });
  }
});
