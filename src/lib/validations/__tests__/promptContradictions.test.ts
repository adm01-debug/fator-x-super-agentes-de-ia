/**
 * Unit tests for the contradiction detector.
 *
 * Coverage:
 *   - Polarity conflicts (PT/EN-flavored prompts)
 *   - Numeric conflicts (range violations + competing exact values + units)
 *   - Language conflicts (multi-language declarations)
 *   - False-positive guards (similar topics, complementary rules,
 *     same polarity, different units, same language repeated, headings)
 */

import { describe, it, expect } from 'vitest';
import {
  detectPromptContradictions,
  countContradictions,
  getContradictionLines,
} from '../promptContradictions';

/* ------------------------------ helpers ------------------------------ */

const kindsOf = (prompt: string) =>
  detectPromptContradictions(prompt).map((c) => c.kind).sort();

/* ------------------------------ polarity ------------------------------ */

describe('polarity contradictions', () => {
  it('detects nunca vs sempre on the same topic (PT)', () => {
    const prompt = [
      'Você é um atendente.',
      '- Nunca compartilhe o preço de tabela com o cliente.',
      '- Sempre compartilhe o preço de tabela quando perguntado.',
    ].join('\n');
    const conflicts = detectPromptContradictions(prompt);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('polarity');
    expect(conflicts[0].lineA).toBe(2);
    expect(conflicts[0].lineB).toBe(3);
  });

  it('detects proibido vs obrigatório on the same topic', () => {
    const prompt = [
      '- É proibido mencionar concorrentes diretos pelo nome.',
      '- É obrigatório mencionar concorrentes diretos para comparação.',
    ].join('\n');
    expect(countContradictions(prompt)).toBeGreaterThanOrEqual(1);
    expect(kindsOf(prompt)).toContain('polarity');
  });

  it('detects "não use" vs "deve usar" on the same artifact', () => {
    const prompt = [
      '- Não use emojis nas respostas formais.',
      '- Deve usar emojis em respostas formais para humanizar.',
    ].join('\n');
    const conflicts = detectPromptContradictions(prompt);
    expect(conflicts.some((c) => c.kind === 'polarity')).toBe(true);
  });

  it('does NOT flag same-polarity rules (both negative on different topics)', () => {
    const prompt = [
      '- Nunca compartilhe dados pessoais.',
      '- Nunca prometa prazos sem confirmar com o gestor.',
    ].join('\n');
    expect(countContradictions(prompt)).toBe(0);
  });

  it('does NOT flag complementary rules with insufficient shared tokens', () => {
    const prompt = [
      '- Sempre cumprimente o cliente pelo primeiro nome.',
      '- Nunca encerre a conversa sem oferecer ajuda adicional.',
    ].join('\n');
    expect(countContradictions(prompt)).toBe(0);
  });

  it('does NOT flag markdown headings as rules', () => {
    const prompt = [
      '## Sempre',
      '## Nunca',
      'Texto livre sem polaridade explícita.',
    ].join('\n');
    expect(countContradictions(prompt)).toBe(0);
  });
});

/* ------------------------------ numeric ------------------------------ */

describe('numeric contradictions', () => {
  it('detects min > max on the same unit (palavras)', () => {
    const prompt = [
      '- Resposta deve ter no mínimo 200 palavras.',
      '- Resposta deve ter no máximo 100 palavras.',
    ].join('\n');
    const conflicts = detectPromptContradictions(prompt);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('numeric');
    expect(conflicts[0].reason).toMatch(/m[íi]nimo.*maior.*m[áa]ximo/i);
  });

  it('detects two different exact values on the same unit', () => {
    const prompt = [
      '- A resposta deve ter exatamente 50 palavras.',
      '- A resposta deve ter exatamente 80 palavras.',
    ].join('\n');
    const conflicts = detectPromptContradictions(prompt);
    expect(conflicts.some((c) => c.kind === 'numeric')).toBe(true);
  });

  it('detects min > max with characters', () => {
    const prompt = [
      '- Pelo menos 500 caracteres por resposta.',
      '- No máximo 200 caracteres por resposta.',
    ].join('\n');
    const conflicts = detectPromptContradictions(prompt);
    expect(conflicts.some((c) => c.kind === 'numeric')).toBe(true);
  });

  it('does NOT flag valid range (min < max) on same unit', () => {
    const prompt = [
      '- Resposta deve ter no mínimo 50 palavras.',
      '- Resposta deve ter no máximo 200 palavras.',
    ].join('\n');
    expect(countContradictions(prompt)).toBe(0);
  });

  it('does NOT flag limits on different units', () => {
    const prompt = [
      '- No máximo 100 palavras por resposta.',
      '- No mínimo 500 caracteres por resposta.',
    ].join('\n');
    expect(countContradictions(prompt)).toBe(0);
  });

  it('does NOT flag a single numeric claim', () => {
    const prompt = '- Resposta deve ter no máximo 150 palavras.';
    expect(countContradictions(prompt)).toBe(0);
  });
});

/* ------------------------------ language ------------------------------ */

describe('language contradictions', () => {
  it('detects português vs inglês mandates', () => {
    const prompt = [
      '- Sempre responder em português.',
      '- Always respond in english.',
    ].join('\n');
    const conflicts = detectPromptContradictions(prompt);
    expect(conflicts.some((c) => c.kind === 'language')).toBe(true);
  });

  it('detects português vs espanhol mandates', () => {
    const prompt = [
      '- O idioma das respostas deve ser português.',
      '- O idioma das respostas deve ser espanhol.',
    ].join('\n');
    expect(kindsOf(prompt)).toContain('language');
  });

  it('detects EN-flavored declaration "respond in french" vs PT mandate', () => {
    const prompt = [
      '- Sempre responder em português brasileiro.',
      '- Respond in french for european clients.',
    ].join('\n');
    expect(kindsOf(prompt)).toContain('language');
  });

  it('does NOT flag the same language repeated', () => {
    const prompt = [
      '- Sempre responder em português.',
      '- O idioma padrão é português brasileiro.',
    ].join('\n');
    expect(countContradictions(prompt)).toBe(0);
  });

  it('does NOT flag generic language mentions without an explicit mandate', () => {
    const prompt = [
      'O cliente pode escrever em qualquer idioma.',
      'Adapte o tom conforme a região.',
    ].join('\n');
    expect(countContradictions(prompt)).toBe(0);
  });
});

/* --------------------------- mixed / general --------------------------- */

describe('mixed prompts and reporting helpers', () => {
  it('reports all three kinds when present together', () => {
    const prompt = [
      '- Nunca revele o preço de tabela ao cliente.',
      '- Sempre revele o preço de tabela quando solicitado.',
      '- No mínimo 200 palavras por resposta.',
      '- No máximo 100 palavras por resposta.',
      '- Sempre responder em português.',
      '- Always respond in english.',
    ].join('\n');
    const kinds = kindsOf(prompt);
    expect(kinds).toContain('polarity');
    expect(kinds).toContain('numeric');
    expect(kinds).toContain('language');
  });

  it('getContradictionLines returns sorted unique line numbers', () => {
    const prompt = [
      '- Nunca compartilhe o preço de tabela.', // 1
      '- Sempre compartilhe o preço de tabela.', // 2
      '- No mínimo 300 palavras.', // 3
      '- No máximo 100 palavras.', // 4
    ].join('\n');
    const lines = getContradictionLines(prompt);
    expect(lines).toEqual([1, 2, 3, 4]);
  });

  it('returns empty array on a clean prompt', () => {
    const prompt = [
      'Você é um atendente comercial educado.',
      '- Sempre cumprimente o cliente pelo nome.',
      '- Confirme o pedido antes de finalizar.',
      '- Resposta deve ter entre 50 e 150 palavras.',
      '- Sempre responder em português.',
    ].join('\n');
    expect(detectPromptContradictions(prompt)).toEqual([]);
  });

  it('handles empty / whitespace-only prompts safely', () => {
    expect(detectPromptContradictions('')).toEqual([]);
    expect(detectPromptContradictions('   \n\n  ')).toEqual([]);
  });
});
