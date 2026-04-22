/**
 * Integration tests for the contradiction detector + auto-fix builder.
 *
 * These tests exercise the real detection + suggestion pipeline (no mocks) to
 * make sure that, given a prompt with a known conflict, we produce a fix whose
 * `fixedPrompt` actually removes the contradiction when re-detected.
 */
import { describe, it, expect } from 'vitest';
import {
  detectPromptContradictions,
  countContradictions,
} from '../promptContradictions';
import {
  buildContradictionAutoFixes,
  applyAllContradictionFixes,
  buildContradictionFixFromSuggestion,
  suggestContradictionRewrites,
} from '../contradictionSuggestions';

const POLARITY_PROMPT = [
  'Você é um agente de suporte.',
  'Sempre responda em português.',
  'Nunca responda em português.',
  'Seja gentil.',
].join('\n');

describe('contradiction detector + auto-fix integration', () => {
  it('detects a polarity contradiction in the sample prompt', () => {
    const conflicts = detectPromptContradictions(POLARITY_PROMPT);
    expect(conflicts.length).toBeGreaterThan(0);
    const polarity = conflicts.find((c) => c.kind === 'polarity');
    expect(polarity).toBeDefined();
    // Lines 2 and 3 (1-indexed) are the conflicting rules.
    expect([polarity!.lineA, polarity!.lineB].sort()).toEqual([2, 3]);
  });

  it('builds an auto-fix whose fixedPrompt removes the contradiction', () => {
    const fixes = buildContradictionAutoFixes(POLARITY_PROMPT);
    expect(fixes.length).toBeGreaterThan(0);
    const fix = fixes[0];
    expect(fix.unifiedRule.length).toBeGreaterThan(0);
    expect(fix.fixedPrompt).not.toBe(POLARITY_PROMPT);
    // Re-running detection on the fixed prompt should yield zero conflicts.
    expect(countContradictions(fix.fixedPrompt)).toBe(0);
  });

  it('preserves unrelated lines when splicing the unified rule', () => {
    const fixes = buildContradictionAutoFixes(POLARITY_PROMPT);
    const fixed = fixes[0].fixedPrompt;
    expect(fixed).toContain('Você é um agente de suporte.');
    expect(fixed).toContain('Seja gentil.');
    // The fixed prompt must be exactly one line shorter (two lines collapsed
    // into a single unified rule).
    const before = POLARITY_PROMPT.split('\n').length;
    const after = fixed.split('\n').length;
    expect(after).toBe(before - 1);
  });

  it('lets the user pick an alternative suggestion that still resolves the conflict', () => {
    const conflicts = detectPromptContradictions(POLARITY_PROMPT);
    const conflict = conflicts[0];
    const suggestions = suggestContradictionRewrites(conflict);
    expect(suggestions.length).toBeGreaterThan(1);

    // Build a fix using the LAST suggestion (not the default one) and confirm
    // it still produces a prompt with no detected conflicts.
    const altIdx = suggestions.length - 1;
    const altFix = buildContradictionFixFromSuggestion(POLARITY_PROMPT, conflict, altIdx);
    expect(altFix.unifiedRule.length).toBeGreaterThan(0);
    expect(countContradictions(altFix.fixedPrompt)).toBe(0);
  });

  it('falls back to the default suggestion when the index is out of range', () => {
    const conflicts = detectPromptContradictions(POLARITY_PROMPT);
    const conflict = conflicts[0];
    const oob = buildContradictionFixFromSuggestion(POLARITY_PROMPT, conflict, 999);
    const def = buildContradictionFixFromSuggestion(POLARITY_PROMPT, conflict, 0);
    expect(oob.unifiedRule).toBe(def.unifiedRule);
    expect(oob.fixedPrompt).toBe(def.fixedPrompt);
  });

  it('applyAllContradictionFixes resolves multiple conflicts sequentially', () => {
    const multi = [
      'Sempre responda em inglês.',
      'Nunca responda em inglês.',
      '',
      'Sempre use emojis.',
      'Nunca use emojis.',
    ].join('\n');

    const initialCount = countContradictions(multi);
    expect(initialCount).toBeGreaterThanOrEqual(2);

    const { fixedPrompt, resolved } = applyAllContradictionFixes(multi);
    expect(resolved).toBeGreaterThanOrEqual(initialCount);
    expect(countContradictions(fixedPrompt)).toBe(0);
  });

  it('returns no fixes for a clean prompt', () => {
    const clean = 'Você é um agente útil.\nResponda sempre com clareza.';
    expect(buildContradictionAutoFixes(clean)).toHaveLength(0);
    expect(applyAllContradictionFixes(clean).resolved).toBe(0);
  });
});
