/**
 * Rodada 6 — tests para as primitivas must-have da análise competitiva:
 *   checkpointStore (in-memory adapter), hitlInterrupt, promptCache,
 *   trustLayer (redact/unredact + audit chain), mcpManifest.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { _memoryCheckpointAdapter } from '@/services/checkpointStore';
import { GraphInterrupt, throwInterrupt } from '@/lib/hitlInterrupt';
import { buildCachedPrompt, cacheKey, estimateCachedTokens } from '@/lib/promptCache';
import {
  TokenVault,
  redact,
  unredact,
  markZeroRetention,
  appendAudit,
  verifyAuditChain,
  applyTrustLayer,
} from '@/lib/trustLayer';
import { buildMcpManifest, buildDiscoveryCard } from '@/lib/mcpManifest';
import { DEFAULT_AGENT } from '@/data/agentBuilderData';

// ═══ Checkpoint store (in-memory) ═════════════════════════════
describe('checkpointStore memory adapter', () => {
  beforeEach(() => _memoryCheckpointAdapter.clear());

  it('stores and retrieves checkpoints in insertion order', () => {
    _memoryCheckpointAdapter.save({
      thread_id: 't1',
      agent_id: 'a1',
      step_index: 0,
      state: { x: 1 },
    });
    _memoryCheckpointAdapter.save({
      thread_id: 't1',
      agent_id: 'a1',
      step_index: 1,
      state: { x: 2 },
    });
    const list = _memoryCheckpointAdapter.list('t1');
    expect(list).toHaveLength(2);
    expect(list[0].step_index).toBe(0);
    expect(list[1].step_index).toBe(1);
  });

  it('lookup by checkpoint_id returns the record', () => {
    const ck = _memoryCheckpointAdapter.save({
      thread_id: 't2',
      agent_id: 'a',
      step_index: 0,
      state: {},
    });
    expect(_memoryCheckpointAdapter.get(ck.checkpoint_id)).not.toBeNull();
  });
});

// ═══ HITL interrupt ═══════════════════════════════════════════
describe('hitlInterrupt.throwInterrupt', () => {
  it('throws a GraphInterrupt carrying payload', () => {
    expect(() =>
      throwInterrupt({
        question: 'Aprovar desconto?',
        resume_tag: 'tag1',
        trigger_key: 'discount',
      }),
    ).toThrow(GraphInterrupt);
  });

  it('GraphInterrupt exposes payload', () => {
    try {
      throwInterrupt({ question: 'x?', resume_tag: 'r1', trigger_key: 'k1' });
    } catch (e) {
      expect(e).toBeInstanceOf(GraphInterrupt);
      expect((e as GraphInterrupt).payload.question).toBe('x?');
      expect((e as GraphInterrupt).payload.resume_tag).toBe('r1');
    }
  });
});

// ═══ Prompt cache ═════════════════════════════════════════════
describe('promptCache.buildCachedPrompt', () => {
  it('marks system + tools + few_shot as cache breakpoints', () => {
    const msgs = buildCachedPrompt({
      system_prompt: 'sys',
      few_shot: [{ input: 'u', expected_output: 'a' }],
      tools_descriptor: '{"tools":[]}',
      user_message: 'Hi',
    });
    const bp = msgs.filter((m) => m.cache_checkpoint);
    expect(bp).toHaveLength(3);
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe('user');
    expect(last.cache_checkpoint).toBeUndefined();
  });

  it('estimateCachedTokens reports sensible savings', () => {
    const msgs = buildCachedPrompt({
      system_prompt: 'a'.repeat(4000),
      few_shot: [],
      user_message: 'b',
    });
    const e = estimateCachedTokens(msgs);
    expect(e.savings_pct).toBeGreaterThan(80);
  });

  it('cacheKey is deterministic for same prefix', () => {
    const base = { system_prompt: 'same', few_shot: [], user_message: 'x' };
    const a = cacheKey(buildCachedPrompt(base));
    const b = cacheKey(buildCachedPrompt({ ...base, user_message: 'y' }));
    expect(a).toBe(b); // prefixo igual → cache key igual
  });
});

// ═══ Trust Layer ══════════════════════════════════════════════
describe('trustLayer.redact/unredact', () => {
  it('tokenizes CPF, email and phone', () => {
    const { text, vault, types_found, replacements } = redact(
      'Meu CPF é 123.456.789-00 e email joao@empresa.com, tel (11) 99999-0000',
    );
    expect(text).not.toMatch(/123\.456\.789-00/);
    expect(text).toContain('<CPF#001>');
    expect(text).toContain('<EMAIL#001>');
    expect(types_found).toEqual(expect.arrayContaining(['CPF', 'EMAIL', 'PHONE']));
    expect(replacements).toBeGreaterThanOrEqual(3);
    expect(vault.size()).toBeGreaterThanOrEqual(3);
  });

  it('unredact reinstates values', () => {
    const r = redact('Email: contato@acme.com');
    const back = unredact(`Te respondo em ${r.text.match(/<EMAIL#\d+>/)![0]}`, r.vault);
    expect(back).toContain('contato@acme.com');
  });

  it('same value within a pass gets the same token', () => {
    const r = redact('a@a.com e novamente a@a.com');
    const matches = r.text.match(/<EMAIL#\d+>/g)!;
    expect(new Set(matches).size).toBe(1);
  });
});

describe('trustLayer.markZeroRetention', () => {
  it('injects anthropic beta + marker when enabled', () => {
    const h = markZeroRetention({}, { zero_retention: true, reason: 'PII' });
    expect(h['X-Nexus-Zero-Retention']).toBe('true');
    expect(h['Anthropic-Beta']).toMatch(/zero-retention/);
  });

  it('is no-op when zero_retention=false', () => {
    const h = markZeroRetention({ X: 'y' }, { zero_retention: false });
    expect(h['X-Nexus-Zero-Retention']).toBeUndefined();
  });
});

describe('trustLayer audit chain', () => {
  it('builds and verifies an intact chain', async () => {
    const l1 = await appendAudit({ step: 1 }, null);
    const l2 = await appendAudit({ step: 2 }, l1);
    const l3 = await appendAudit({ step: 3 }, l2);
    expect(await verifyAuditChain([l1, l2, l3])).toBe(true);
  });

  it('detects tampering (missing link)', async () => {
    const l1 = await appendAudit({ step: 1 }, null);
    const l2 = await appendAudit({ step: 2 }, l1);
    const l3 = await appendAudit({ step: 3 }, l2);
    expect(await verifyAuditChain([l1, l3])).toBe(false);
  });
});

describe('trustLayer.applyTrustLayer pipeline', () => {
  it('redacts PII, chains audit, sets headers', async () => {
    const result = await applyTrustLayer('Meu CPF é 111.222.333-44', {
      zero_retention: true,
    });
    expect(result.redacted_input).toContain('<CPF#001>');
    expect(result.types_found).toContain('CPF');
    expect(result.audit.seq).toBe(1);
    expect(result.headers['X-Nexus-Zero-Retention']).toBe('true');
  });
});

// ═══ MCP Manifest ═════════════════════════════════════════════
describe('mcpManifest.buildMcpManifest', () => {
  it('emits protocol version + serverInfo + capabilities', () => {
    const agent = {
      ...DEFAULT_AGENT,
      name: 'Test Agent',
      tools: [],
      rag_sources: [],
    };
    const m = buildMcpManifest(agent);
    expect(m.protocolVersion).toBe('2025-06-18');
    expect(m.serverInfo.vendor).toBe('nexus-agents-studio');
    expect(m.capabilities.tools).toBeDefined();
    expect(m.prompts).toHaveLength(1);
    expect(m.prompts[0].name).toBe('invoke_agent');
  });
});

describe('mcpManifest.buildDiscoveryCard', () => {
  it('produces an A2A-compatible card', () => {
    const card = buildDiscoveryCard(
      { ...DEFAULT_AGENT, name: 'Closer', avatar_emoji: '💼' },
      { mcp: 'https://api/mcp/x', a2a: 'https://api/a2a/x' },
    );
    expect(card.name).toBe('Closer');
    expect(card.emoji).toBe('💼');
    expect(card.vendor).toBe('nexus-agents-studio');
    expect(card.endpoint_mcp).toBe('https://api/mcp/x');
    expect(card.languages).toContain('pt-BR');
  });
});

// ═══ TokenVault direto ═══════════════════════════════════════
describe('TokenVault', () => {
  it('increments counters per type independently', () => {
    const v = new TokenVault();
    expect(v.tokenize('a@a.com', 'EMAIL')).toBe('<EMAIL#001>');
    expect(v.tokenize('b@b.com', 'EMAIL')).toBe('<EMAIL#002>');
    expect(v.tokenize('111.222.333-44', 'CPF')).toBe('<CPF#001>');
    expect(v.toMappings()).toHaveLength(3);
  });
});
