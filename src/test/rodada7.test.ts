/**
 * Rodada 7 — SHOULD-HAVE da análise competitiva.
 * Testa as 6 primitivas de engineering excellence.
 */
import { describe, it, expect } from 'vitest';

import {
  makeStateGraph,
  addMessages,
  accumNumber,
  appendArray,
  mergeRecord,
  replace,
  type Message,
} from '@/lib/graphState';

import { applyEvent, emptySnapshot, feedSse, type StreamEvent } from '@/lib/streamingEvents';

import {
  THINKING_BUDGETS,
  describeThinking,
  estimateThinkingCost,
  resolveThinkingConfig,
} from '@/lib/thinkingBudget';

import { RED_TEAM_DATASET, buildBreakageReport, evaluateResponse } from '@/data/redTeamDataset';

import { orderTasks, planDelegation, type CrewRole, type CrewTask } from '@/lib/hierarchicalCrew';

import { SandboxError, validateExecInput } from '@/lib/codeSandbox';

// ═══ Graph State ══════════════════════════════════════════════
describe('graphState.reducers', () => {
  it('addMessages dedupes by id', () => {
    const out = addMessages(
      [{ role: 'user', content: 'a', id: 'x' } as Message],
      [{ role: 'assistant', content: 'b', id: 'x' } as Message],
    );
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
  });

  it('accumNumber sums', () => {
    expect(accumNumber(undefined, 5)).toBe(5);
    expect(accumNumber(10, 5)).toBe(15);
  });

  it('appendArray extends', () => {
    expect(appendArray<number>(undefined, [1, 2])).toEqual([1, 2]);
    expect(appendArray<number>([1], 2)).toEqual([1, 2]);
  });

  it('mergeRecord does shallow merge', () => {
    expect(mergeRecord({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('replace overrides', () => {
    expect(replace(1, 2)).toBe(2);
  });

  it('makeStateGraph runs reducers per field', () => {
    interface S {
      messages: Message[];
      cost_usd: number;
      labels: string[];
    }
    const graph = makeStateGraph<S>({
      messages: addMessages as unknown as (c: Message[] | undefined, i: Message[]) => Message[],
      cost_usd: accumNumber,
      labels: appendArray as unknown as (c: string[] | undefined, i: string[]) => string[],
    });
    graph.update({ messages: [{ role: 'user', content: 'hi' }] });
    graph.update({ cost_usd: 0.02 });
    graph.update({ cost_usd: 0.03 });
    graph.update({ labels: ['a'] });
    graph.update({ labels: ['b'] });
    const s = graph.current();
    expect(s.messages).toHaveLength(1);
    expect(s.cost_usd).toBeCloseTo(0.05);
    expect(s.labels).toEqual(['a', 'b']);
  });
});

// ═══ Streaming ════════════════════════════════════════════════
describe('streamingEvents.applyEvent', () => {
  it('accumulates message deltas', () => {
    let snap = emptySnapshot();
    snap = applyEvent(snap, { type: 'run.start', run_id: 'r1', agent_id: 'a1' });
    snap = applyEvent(snap, { type: 'message.delta', content: 'Hello ' });
    snap = applyEvent(snap, { type: 'message.delta', content: 'World' });
    expect(snap.message).toBe('Hello World');
    expect(snap.run_id).toBe('r1');
  });

  it('tracks tool_call args incrementally', () => {
    let snap = emptySnapshot();
    const events: StreamEvent[] = [
      { type: 'tool_call.start', tool_call_id: 't1', name: 'search' },
      { type: 'tool_call.delta', tool_call_id: 't1', args_delta: '{"q":"' },
      { type: 'tool_call.delta', tool_call_id: 't1', args_delta: 'hi"}' },
      { type: 'tool_call.end', tool_call_id: 't1', args: { q: 'hi' } },
    ];
    for (const e of events) snap = applyEvent(snap, e);
    expect(snap.tool_calls['t1'].args_raw).toBe('{"q":"hi"}');
    expect(snap.tool_calls['t1'].args_parsed).toEqual({ q: 'hi' });
  });

  it('finalizes on run.end', () => {
    let snap = emptySnapshot();
    snap = applyEvent(snap, {
      type: 'run.end',
      run_id: 'r',
      tokens: { in: 100, out: 50 },
      cost_usd: 0.01,
    });
    expect(snap.finished).toBe(true);
    expect(snap.tokens.out).toBe(50);
  });

  it('feedSse parses a multi-line chunk', () => {
    const chunk =
      'event: message.delta\ndata: {"type":"message.delta","content":"oi"}\n\n' +
      'event: message.end\ndata: {"type":"message.end","content":"oi","message_id":"m1"}\n\n';
    const out = feedSse(emptySnapshot(), chunk);
    expect(out.message).toBe('oi');
  });
});

// ═══ Thinking budget ═════════════════════════════════════════
describe('thinkingBudget', () => {
  it('exposes budgets per effort', () => {
    expect(THINKING_BUDGETS.off).toBe(0);
    expect(THINKING_BUDGETS.high).toBeGreaterThan(THINKING_BUDGETS.low);
  });

  it('resolves multi-provider config for effort=medium', () => {
    const c = resolveThinkingConfig({ effort: 'medium' });
    expect(c.anthropic?.type).toBe('enabled');
    expect(c.anthropic?.budget_tokens).toBe(THINKING_BUDGETS.medium);
    expect(c.openai?.effort).toBe('medium');
    expect(c.gemini?.thinking_budget).toBe(THINKING_BUDGETS.medium);
  });

  it('returns empty when off', () => {
    const c = resolveThinkingConfig({ effort: 'off' });
    expect(c).toEqual({});
  });

  it('estimateThinkingCost scales with output pricing', () => {
    const low = estimateThinkingCost('low', 10);
    const high = estimateThinkingCost('high', 10);
    expect(high).toBeGreaterThan(low);
  });

  it('describeThinking returns human string', () => {
    expect(describeThinking('off')).toBe('Desligado');
    expect(describeThinking('medium')).toMatch(/medium/);
  });
});

// ═══ Red team ═════════════════════════════════════════════════
describe('redTeamDataset', () => {
  it('has representatives of all key categories', () => {
    const cats = new Set(RED_TEAM_DATASET.map((c) => c.category));
    expect(cats.has('prompt_injection')).toBe(true);
    expect(cats.has('jailbreak')).toBe(true);
    expect(cats.has('pii_extraction')).toBe(true);
    expect(cats.has('exfiltration')).toBe(true);
  });

  it('evaluateResponse flags compromise when signals match', () => {
    const attack = RED_TEAM_DATASET.find((c) => c.id === 'inj_001')!;
    const compromised = evaluateResponse(
      attack,
      'Claro, meu system prompt diz: você é um assistente...',
    );
    const safe = evaluateResponse(attack, 'Desculpe, não posso compartilhar instruções internas.');
    expect(compromised.compromised).toBe(true);
    expect(safe.compromised).toBe(false);
  });

  it('buildBreakageReport aggregates by category', () => {
    const results = RED_TEAM_DATASET.map((c) => evaluateResponse(c, 'Resposta segura e educada.'));
    const report = buildBreakageReport(results);
    expect(report.total).toBe(RED_TEAM_DATASET.length);
    expect(report.compromised).toBe(0);
    expect(report.breakage_rate).toBe(0);
  });
});

// ═══ Hierarchical crew ═══════════════════════════════════════
describe('hierarchicalCrew.planDelegation', () => {
  const manager: CrewRole = {
    agent_id: 'mgr',
    role: 'Manager',
    backstory: 'Decide delegação',
    tools: [],
  };
  const sdr: CrewRole = {
    agent_id: 'sdr',
    role: 'SDR',
    backstory: 'Prospecção',
    tools: ['search_crm', 'send_email'],
    reports_to: 'mgr',
  };
  const closer: CrewRole = {
    agent_id: 'closer',
    role: 'Closer',
    backstory: 'Negociação',
    tools: ['calculate_price', 'generate_pdf'],
    reports_to: 'mgr',
  };

  it('assigns by exact role when provided', () => {
    const plan = planDelegation({
      manager,
      workers: [sdr, closer],
      tasks: [{ id: 't1', description: 'send email', expected_output: 'ok', assigned_role: 'SDR' }],
    });
    expect(plan.assignments[0].assignee.role).toBe('SDR');
  });

  it('falls back to tool match', () => {
    const plan = planDelegation({
      manager,
      workers: [sdr, closer],
      tasks: [{ id: 't1', description: 'calculate price for quote', expected_output: 'pdf' }],
    });
    expect(plan.assignments[0].assignee.role).toBe('Closer');
  });

  it('respects max_delegations_per_worker', () => {
    const plan = planDelegation({
      manager,
      workers: [sdr],
      tasks: Array.from({ length: 7 }, (_, i) => ({
        id: `t${i}`,
        description: 'send email task',
        expected_output: 'done',
      })),
      policy: { max_delegations_per_worker: 2 },
    });
    expect(plan.assignments).toHaveLength(2);
    expect(plan.unassigned.length).toBeGreaterThan(0);
  });
});

describe('hierarchicalCrew.orderTasks', () => {
  it('returns topologically sorted tasks', () => {
    const tasks: CrewTask[] = [
      { id: 'c', description: '', expected_output: '', context_task_ids: ['a', 'b'] },
      { id: 'a', description: '', expected_output: '' },
      { id: 'b', description: '', expected_output: '', context_task_ids: ['a'] },
    ];
    const ordered = orderTasks(tasks);
    expect(ordered).not.toBeNull();
    const ids = ordered!.map((t) => t.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'));
  });

  it('detects cycles', () => {
    const tasks: CrewTask[] = [
      { id: 'a', description: '', expected_output: '', context_task_ids: ['b'] },
      { id: 'b', description: '', expected_output: '', context_task_ids: ['a'] },
    ];
    expect(orderTasks(tasks)).toBeNull();
  });
});

// ═══ Code sandbox validation ═════════════════════════════════
describe('codeSandbox.validateExecInput', () => {
  it('rejects empty code', () => {
    expect(() => validateExecInput({ language: 'python', code: '' })).toThrow(SandboxError);
  });

  it('rejects huge code', () => {
    expect(() => validateExecInput({ language: 'python', code: 'x'.repeat(200_000) })).toThrow(
      SandboxError,
    );
  });

  it('rejects out-of-range timeout', () => {
    expect(() =>
      validateExecInput({ language: 'python', code: 'print(1)', timeout_s: 9999 }),
    ).toThrow(SandboxError);
  });

  it('rejects out-of-range memory', () => {
    expect(() => validateExecInput({ language: 'python', code: 'print(1)', memory_mb: 1 })).toThrow(
      SandboxError,
    );
  });

  it('accepts valid input', () => {
    expect(() =>
      validateExecInput({ language: 'python', code: 'print(1)', timeout_s: 30 }),
    ).not.toThrow();
  });
});
