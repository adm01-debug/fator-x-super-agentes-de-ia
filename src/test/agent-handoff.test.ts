/**
 * agentHandoffService tests
 *
 * Covers: evaluateHandoffRules, matchesCondition (keyword, intent,
 * threshold, custom), prepareHandoffContext, triageHandoff.
 * Pure functions only — DB-dependent functions are mocked.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateHandoffRules,
  prepareHandoffContext,
  triageHandoff,
  type HandoffRule,
  type HandoffCondition,
} from '@/services/agentHandoffService';

// ──────── Helpers ────────

function makeRule(overrides: Partial<HandoffRule> & { condition: HandoffCondition }): HandoffRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    description: 'Test',
    sourceAgentId: 'agent-a',
    targetAgentId: 'agent-b',
    reason: 'delegation',
    autoAccept: false,
    priority: 5,
    enabled: true,
    ...overrides,
  };
}

// ──────── evaluateHandoffRules ────────

describe('agentHandoffService — evaluateHandoffRules', () => {
  it('filters out disabled rules', () => {
    const rules = [
      makeRule({
        id: 'disabled',
        enabled: false,
        condition: { type: 'keyword', keywords: ['help'] },
      }),
      makeRule({
        id: 'enabled',
        enabled: true,
        condition: { type: 'keyword', keywords: ['help'] },
      }),
    ];
    const result = evaluateHandoffRules(rules, { lastMessage: 'I need help', state: {} });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('enabled');
  });

  it('sorts matching rules by priority descending', () => {
    const rules = [
      makeRule({ id: 'low', priority: 1, condition: { type: 'keyword', keywords: ['help'] } }),
      makeRule({ id: 'high', priority: 10, condition: { type: 'keyword', keywords: ['help'] } }),
      makeRule({ id: 'mid', priority: 5, condition: { type: 'keyword', keywords: ['help'] } }),
    ];
    const result = evaluateHandoffRules(rules, { lastMessage: 'help me', state: {} });
    expect(result.map((r) => r.id)).toEqual(['high', 'mid', 'low']);
  });

  it('returns empty when no rules match', () => {
    const rules = [makeRule({ condition: { type: 'keyword', keywords: ['specific'] } })];
    const result = evaluateHandoffRules(rules, { lastMessage: 'unrelated message', state: {} });
    expect(result).toHaveLength(0);
  });
});

// ──────── matchesCondition (via evaluateHandoffRules) ────────

describe('agentHandoffService — keyword condition', () => {
  it('matches when keyword is in message (case insensitive)', () => {
    const rules = [makeRule({ condition: { type: 'keyword', keywords: ['URGENT'] } })];
    const result = evaluateHandoffRules(rules, { lastMessage: 'this is urgent please', state: {} });
    expect(result).toHaveLength(1);
  });

  it('no match when keywords absent', () => {
    const rules = [makeRule({ condition: { type: 'keyword', keywords: ['billing'] } })];
    const result = evaluateHandoffRules(rules, { lastMessage: 'general inquiry', state: {} });
    expect(result).toHaveLength(0);
  });
});

describe('agentHandoffService — intent condition', () => {
  it('matches when detected intent is in intents list', () => {
    const rules = [makeRule({ condition: { type: 'intent', intents: ['refund', 'cancel'] } })];
    const result = evaluateHandoffRules(rules, {
      lastMessage: 'some message',
      detectedIntent: 'refund',
      state: {},
    });
    expect(result).toHaveLength(1);
  });

  it('no match when detectedIntent is undefined', () => {
    const rules = [makeRule({ condition: { type: 'intent', intents: ['refund'] } })];
    const result = evaluateHandoffRules(rules, { lastMessage: 'msg', state: {} });
    expect(result).toHaveLength(0);
  });

  it('no match when intent not in list', () => {
    const rules = [makeRule({ condition: { type: 'intent', intents: ['refund'] } })];
    const result = evaluateHandoffRules(rules, {
      lastMessage: 'msg',
      detectedIntent: 'greeting',
      state: {},
    });
    expect(result).toHaveLength(0);
  });
});

describe('agentHandoffService — threshold condition', () => {
  it('gt operator works', () => {
    const rules = [
      makeRule({ condition: { type: 'threshold', field: 'score', operator: 'gt', value: 0.8 } }),
    ];
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: { score: 0.9 } })).toHaveLength(1);
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: { score: 0.5 } })).toHaveLength(0);
  });

  it('lt operator works', () => {
    const rules = [
      makeRule({
        condition: { type: 'threshold', field: 'confidence', operator: 'lt', value: 0.3 },
      }),
    ];
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { confidence: 0.1 } }),
    ).toHaveLength(1);
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { confidence: 0.5 } }),
    ).toHaveLength(0);
  });

  it('eq operator works', () => {
    const rules = [
      makeRule({ condition: { type: 'threshold', field: 'count', operator: 'eq', value: 3 } }),
    ];
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: { count: 3 } })).toHaveLength(1);
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: { count: 4 } })).toHaveLength(0);
  });

  it('gte and lte operators work', () => {
    const gteRules = [
      makeRule({ condition: { type: 'threshold', field: 'x', operator: 'gte', value: 5 } }),
    ];
    expect(evaluateHandoffRules(gteRules, { lastMessage: '', state: { x: 5 } })).toHaveLength(1);
    expect(evaluateHandoffRules(gteRules, { lastMessage: '', state: { x: 4 } })).toHaveLength(0);

    const lteRules = [
      makeRule({ condition: { type: 'threshold', field: 'x', operator: 'lte', value: 5 } }),
    ];
    expect(evaluateHandoffRules(lteRules, { lastMessage: '', state: { x: 5 } })).toHaveLength(1);
    expect(evaluateHandoffRules(lteRules, { lastMessage: '', state: { x: 6 } })).toHaveLength(0);
  });

  it('contains operator works', () => {
    const rules = [
      makeRule({
        condition: { type: 'threshold', field: 'status', operator: 'contains', value: 'error' },
      }),
    ];
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { status: 'has_error_flag' } }),
    ).toHaveLength(1);
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: { status: 'ok' } })).toHaveLength(
      0,
    );
  });

  it('returns false when field is missing from state', () => {
    const rules = [
      makeRule({ condition: { type: 'threshold', field: 'missing', operator: 'gt', value: 0 } }),
    ];
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: {} })).toHaveLength(0);
  });
});

describe('agentHandoffService — custom condition', () => {
  it('parses "field operator value" expression', () => {
    const rules = [makeRule({ condition: { type: 'custom', expression: 'confidence gt 0.8' } })];
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { confidence: 0.9 } }),
    ).toHaveLength(1);
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { confidence: 0.5 } }),
    ).toHaveLength(0);
  });

  it('supports single-field boolean check', () => {
    const rules = [makeRule({ condition: { type: 'custom', expression: 'isEscalated' } })];
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { isEscalated: true } }),
    ).toHaveLength(1);
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { isEscalated: false } }),
    ).toHaveLength(0);
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: {} })).toHaveLength(0);
  });

  it('eq in custom compares as string', () => {
    const rules = [makeRule({ condition: { type: 'custom', expression: 'status eq error' } })];
    expect(
      evaluateHandoffRules(rules, { lastMessage: '', state: { status: 'error' } }),
    ).toHaveLength(1);
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: { status: 'ok' } })).toHaveLength(
      0,
    );
  });

  it('invalid expression returns false', () => {
    const rules = [makeRule({ condition: { type: 'custom', expression: '' } })];
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: {} })).toHaveLength(0);
  });
});

describe('agentHandoffService — schedule condition', () => {
  it('always returns false (handled externally)', () => {
    const rules = [makeRule({ condition: { type: 'schedule' } })];
    expect(evaluateHandoffRules(rules, { lastMessage: '', state: {} })).toHaveLength(0);
  });
});

// ──────── prepareHandoffContext ────────

describe('agentHandoffService — prepareHandoffContext', () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({
    role: 'user' as const,
    content: `Message ${i}`,
  }));

  it('trims messages to maxMessages', () => {
    const ctx = prepareHandoffContext(messages, {}, { maxMessages: 10 });
    expect(ctx.messages.length).toBeLessThanOrEqual(10);
  });

  it('preserves first system message when trimming', () => {
    const withSystem = [{ role: 'system' as const, content: 'You are helpful' }, ...messages];
    const ctx = prepareHandoffContext(withSystem, {}, { maxMessages: 5 });
    expect(ctx.messages[0].role).toBe('system');
    expect(ctx.messages[0].content).toBe('You are helpful');
  });

  it('excludes system message when includeSystemPrompt is false', () => {
    const withSystem = [{ role: 'system' as const, content: 'System prompt' }, ...messages];
    const ctx = prepareHandoffContext(
      withSystem,
      {},
      {
        maxMessages: 5,
        includeSystemPrompt: false,
      },
    );
    // System message should not be prepended
    expect(ctx.messages[0].content).not.toBe('System prompt');
  });

  it('passes state through unchanged', () => {
    const state = { key: 'value', nested: { a: 1 } };
    const ctx = prepareHandoffContext([], state);
    expect(ctx.state).toBe(state);
  });

  it('includes artifacts and instructions from options', () => {
    const artifacts = [{ type: 'text' as const, name: 'note', content: 'hello' }];
    const ctx = prepareHandoffContext(
      [],
      {},
      {
        artifacts,
        instructions: 'Handle this carefully',
      },
    );
    expect(ctx.artifacts).toBe(artifacts);
    expect(ctx.instructions).toBe('Handle this carefully');
  });

  it('does not trim when messages <= maxMessages', () => {
    const short = [{ role: 'user' as const, content: 'hi' }];
    const ctx = prepareHandoffContext(short, {}, { maxMessages: 20 });
    expect(ctx.messages).toHaveLength(1);
  });
});

// ──────── triageHandoff ────────

describe('agentHandoffService — triageHandoff', () => {
  const agents = [
    {
      id: 'billing',
      name: 'Billing Agent',
      description: 'Handle billing and payments',
      skills: ['billing', 'invoice', 'payment'],
    },
    {
      id: 'tech',
      name: 'Tech Support',
      description: 'Technical support for products',
      skills: ['technical', 'bug', 'error', 'setup'],
    },
    {
      id: 'sales',
      name: 'Sales Agent',
      description: 'Help with sales and pricing',
      skills: ['pricing', 'discount', 'quote'],
    },
  ];

  it('routes to agent with matching skills', async () => {
    const result = await triageHandoff('triage', 'I have a billing invoice question', agents, []);
    expect(result).not.toBeNull();
    expect(result!.targetAgentId).toBe('billing');
    expect(result!.reason).toBe('triage');
  });

  it('skill matches weight 3x more than description matches', async () => {
    // "error" is a skill of tech agent
    const result = await triageHandoff('triage', 'I got an error', agents, []);
    expect(result).not.toBeNull();
    expect(result!.targetAgentId).toBe('tech');
  });

  it('returns null when no agent matches', async () => {
    const result = await triageHandoff('triage', 'xyzzy completely unrelated 12345', agents, []);
    expect(result).toBeNull();
  });

  it('includes triage score in context state', async () => {
    const result = await triageHandoff('triage', 'billing payment help', agents, []);
    expect(result).not.toBeNull();
    expect(result!.context.state.triageScore).toBeGreaterThan(0);
  });

  it('includes instructions with user message', async () => {
    const result = await triageHandoff('triage', 'billing question', agents, []);
    expect(result).not.toBeNull();
    expect(result!.context.instructions).toContain('billing question');
  });
});
