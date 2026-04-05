import { describe, it, expect } from 'vitest';
import {
  generateCandidates,
  evaluateCandidates,
  curateBest,
  runACECycle,
  getDefaultACEConfig,
} from '@/services/acePlaybooksService';
import type { EvolutionStrategy, PromptCandidate } from '@/services/acePlaybooksService';

const SAMPLE_PROMPT = 'Você é um assistente de vendas. Ajude clientes a encontrar produtos.';

describe('ACE Playbooks — Generator', () => {
  it('generates the correct number of candidates', () => {
    const candidates = generateCandidates(SAMPLE_PROMPT, ['refine_clarity', 'add_examples'], 4);
    expect(candidates.length).toBe(4);
  });

  it('applies different strategies to each candidate', () => {
    const strategies: EvolutionStrategy[] = ['refine_clarity', 'add_constraints', 'chain_of_thought'];
    const candidates = generateCandidates(SAMPLE_PROMPT, strategies, 3);
    expect(candidates[0].strategy).toBe('refine_clarity');
    expect(candidates[1].strategy).toBe('add_constraints');
    expect(candidates[2].strategy).toBe('chain_of_thought');
  });

  it('each candidate has a different prompt than original', () => {
    const candidates = generateCandidates(SAMPLE_PROMPT, ['add_examples'], 1);
    expect(candidates[0].prompt_text).not.toBe(SAMPLE_PROMPT);
    expect(candidates[0].prompt_text.length).toBeGreaterThan(SAMPLE_PROMPT.length);
  });

  it('all strategies produce valid mutations', () => {
    const allStrategies: EvolutionStrategy[] = [
      'refine_clarity', 'add_examples', 'add_constraints', 'simplify',
      'specialize', 'generalize', 'chain_of_thought', 'persona_shift',
    ];
    const candidates = generateCandidates(SAMPLE_PROMPT, allStrategies, 8);
    candidates.forEach(c => {
      expect(c.prompt_text.length).toBeGreaterThan(0);
      expect(c.id).toContain('candidate-');
    });
  });
});

describe('ACE Playbooks — Reflector', () => {
  it('scores all candidates with composite', () => {
    const candidates = generateCandidates(SAMPLE_PROMPT, ['add_constraints', 'chain_of_thought'], 2);
    const weights = { accuracy: 0.4, helpfulness: 0.3, safety: 0.2, efficiency: 0.1 };
    const evaluated = evaluateCandidates(candidates, [], weights);
    evaluated.forEach(c => {
      expect(c.scores.composite).toBeGreaterThan(0);
      expect(c.scores.accuracy).toBeGreaterThan(0);
      expect(c.reasoning.length).toBeGreaterThan(0);
    });
  });

  it('add_constraints strategy scores higher on safety', () => {
    const constrained = generateCandidates(SAMPLE_PROMPT, ['add_constraints'], 1);
    const simple = generateCandidates(SAMPLE_PROMPT, ['simplify'], 1);
    const weights = { accuracy: 0.25, helpfulness: 0.25, safety: 0.25, efficiency: 0.25 };
    const [evalC] = evaluateCandidates(constrained, [], weights);
    const [evalS] = evaluateCandidates(simple, [], weights);
    expect(evalC.scores.safety).toBeGreaterThanOrEqual(evalS.scores.safety);
  });
});

describe('ACE Playbooks — Curator', () => {
  it('selects the highest scoring candidate', () => {
    const candidates: PromptCandidate[] = [
      { id: 'a', prompt_text: 'A', strategy: 'refine_clarity', scores: { accuracy: 0.5, helpfulness: 0.5, safety: 0.5, efficiency: 0.5, composite: 0.5 }, reasoning: '' },
      { id: 'b', prompt_text: 'B', strategy: 'add_examples', scores: { accuracy: 0.9, helpfulness: 0.9, safety: 0.9, efficiency: 0.9, composite: 0.9 }, reasoning: '' },
    ];
    const { winner } = curateBest(candidates, 0.5, 0.05);
    expect(winner?.id).toBe('b');
  });

  it('rejects candidates below improvement threshold', () => {
    const candidates: PromptCandidate[] = [
      { id: 'a', prompt_text: 'A', strategy: 'refine_clarity', scores: { accuracy: 0.5, helpfulness: 0.5, safety: 0.5, efficiency: 0.5, composite: 0.51 }, reasoning: '' },
    ];
    const { improved } = curateBest(candidates, 0.50, 0.10);
    expect(improved).toBe(false);
  });

  it('handles empty candidates', () => {
    const { winner, improved } = curateBest([], 0.5, 0.05);
    expect(winner).toBeNull();
    expect(improved).toBe(false);
  });
});

describe('ACE Playbooks — Full Pipeline', () => {
  it('runs a complete ACE cycle', () => {
    const result = runACECycle(SAMPLE_PROMPT);
    expect(result.status).toBe('completed');
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.original_prompt).toBe(SAMPLE_PROMPT);
    expect(result.completed_at).toBeTruthy();
  });

  it('respects custom config', () => {
    const result = runACECycle(SAMPLE_PROMPT, {
      candidates_per_iteration: 5,
      strategies: ['add_examples', 'chain_of_thought'],
    });
    expect(result.candidates.length).toBe(5);
  });

  it('getDefaultACEConfig returns valid config', () => {
    const config = getDefaultACEConfig();
    expect(config.max_iterations).toBeGreaterThan(0);
    expect(config.strategies.length).toBeGreaterThan(0);
    expect(config.weights.accuracy + config.weights.helpfulness + config.weights.safety + config.weights.efficiency).toBeCloseTo(1.0);
  });
});
