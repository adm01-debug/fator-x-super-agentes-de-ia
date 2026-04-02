import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══ Mock dependencies ═══
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ data: [], error: null }), insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }), catch: () => {} }), upsert: () => ({ catch: () => {} }) }), auth: { getSession: () => ({ data: { session: null } }) }, functions: { invoke: () => ({ data: null, error: null }) } } }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// ═══ 1. modelRouter ═══
import { selectModel, getEndpoints, getFallbackChains, getCacheStats, setEndpointEnabled } from '@/services/modelRouter';

describe('modelRouter', () => {
  it('selectModel returns a valid model from default chain', () => {
    const result = selectModel('default');
    expect(result.modelId).toBeTruthy();
    expect(result.attempt).toBeGreaterThanOrEqual(0);
  });

  it('getEndpoints returns 4 endpoints', () => {
    const eps = getEndpoints();
    expect(eps.length).toBe(4);
    expect(eps[0]).toHaveProperty('modelId');
    expect(eps[0]).toHaveProperty('maxRpm');
  });

  it('getFallbackChains returns 4 chains', () => {
    const chains = getFallbackChains();
    expect(chains.length).toBe(4);
    expect(chains.map(c => c.name)).toContain('default');
    expect(chains.map(c => c.name)).toContain('fast');
  });

  it('getCacheStats returns size and hits', () => {
    const stats = getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('totalHits');
  });

  it('setEndpointEnabled disables endpoint', () => {
    setEndpointEnabled('claude-sonnet', false);
    const ep = getEndpoints().find(e => e.id === 'claude-sonnet');
    expect(ep?.enabled).toBe(false);
    setEndpointEnabled('claude-sonnet', true); // restore
  });
});

// ═══ 2. graphEngine ═══
import { StateGraph, createLLMNode, createRouterNode, createHITLNode, createToolNode, saveCheckpoint, getCheckpoints, restoreCheckpoint } from '@/services/graphEngine';

describe('graphEngine', () => {
  it('StateGraph compiles with nodes and edges', () => {
    const graph = new StateGraph();
    graph.addNode('start', { type: 'custom', label: 'Start', execute: async (s) => s });
    graph.addNode('end', { type: 'custom', label: 'End', execute: async (s) => ({ ...s, status: 'completed' as const }) });
    graph.setEntryPoint('start');
    graph.addEdge('start', 'end');
    const config = graph.compile();
    expect(config.nodes.size).toBe(2);
    expect(config.edges.length).toBe(1);
    expect(config.entryPoint).toBe('start');
  });

  it('createLLMNode returns valid node', () => {
    const node = createLLMNode('Test', 'You are a test');
    expect(node.type).toBe('llm');
    expect(node.label).toBe('Test');
  });

  it('createRouterNode returns conditional node', () => {
    const node = createRouterNode('Router', () => 'next');
    expect(node.type).toBe('conditional');
  });

  it('createHITLNode returns human node', () => {
    const node = createHITLNode('Approval');
    expect(node.type).toBe('human');
  });

  it('createToolNode returns tool node', () => {
    const node = createToolNode('Search', async () => 'result');
    expect(node.type).toBe('tool');
  });

  it('checkpoint save and restore', () => {
    const state = { messages: [], currentNode: 'test', iteration: 3, status: 'running' as const };
    const cp = saveCheckpoint('graph-1', state, 'test');
    expect(cp.id).toBeTruthy();
    expect(cp.graphId).toBe('graph-1');
    const restored = restoreCheckpoint(cp.id);
    expect(restored?.iteration).toBe(3);
    expect(getCheckpoints('graph-1').length).toBeGreaterThan(0);
  });
});

// ═══ 3. anomalyDetection ═══
import { calculateHealthScore, detectAnomaly, getBaselines } from '@/services/anomalyDetection';

describe('anomalyDetection', () => {
  it('calculateHealthScore returns 0-100 scores', () => {
    const score = calculateHealthScore();
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score).toHaveProperty('latency');
    expect(score).toHaveProperty('errorRate');
  });

  it('detectAnomaly with no baseline returns normal', () => {
    const result = detectAnomaly('unknown_metric', 100);
    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBe('normal');
  });

  it('getBaselines returns array', () => {
    const baselines = getBaselines();
    expect(Array.isArray(baselines)).toBe(true);
  });
});

// ═══ 4. graphRag ═══
import { listGraphs, getGraph, getGraphStats } from '@/services/graphRag';

describe('graphRag', () => {
  it('listGraphs initially empty', () => {
    expect(listGraphs()).toEqual([]);
  });

  it('getGraph returns null for unknown ID', () => {
    expect(getGraph('nonexistent')).toBeNull();
  });

  it('getGraphStats returns null for unknown ID', () => {
    expect(getGraphStats('nonexistent')).toBeNull();
  });
});

// ═══ 5. selfEditingMemory ═══
import { getCoreMemory, updateCoreMemory, memoryTools, buildMemoryAugmentedPrompt } from '@/services/selfEditingMemory';

describe('selfEditingMemory', () => {
  it('getCoreMemory returns empty defaults', () => {
    const core = getCoreMemory('test-agent');
    expect(core).toHaveProperty('persona');
    expect(core).toHaveProperty('userBlock');
    expect(core).toHaveProperty('systemBlock');
  });

  it('updateCoreMemory persists changes', () => {
    updateCoreMemory('test-agent-2', { persona: 'I am a helpful assistant' });
    const core = getCoreMemory('test-agent-2');
    expect(core.persona).toBe('I am a helpful assistant');
  });

  it('memoryTools has 5 tools', () => {
    expect(memoryTools.length).toBe(5);
    expect(memoryTools.map(t => t.name)).toContain('core_memory_replace');
    expect(memoryTools.map(t => t.name)).toContain('archival_memory_insert');
    expect(memoryTools.map(t => t.name)).toContain('archival_memory_search');
    expect(memoryTools.map(t => t.name)).toContain('recall_memory_search');
    expect(memoryTools.map(t => t.name)).toContain('memory_forget');
  });

  it('buildMemoryAugmentedPrompt includes base prompt', () => {
    const prompt = buildMemoryAugmentedPrompt('test-agent', 'You are helpful', 'hello');
    expect(prompt).toContain('You are helpful');
  });
});

// ═══ 6. vectorSearch ═══
import { generateEmbedding } from '@/services/vectorSearch';

describe('vectorSearch', () => {
  it('generateEmbedding returns fallback hash for text', async () => {
    const result = await generateEmbedding('hello world test');
    expect(result.model).toBe('fallback-hash');
    expect(result.embedding.length).toBe(384);
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('generateEmbedding handles empty text', async () => {
    const result = await generateEmbedding('');
    expect(result.model).toBe('fallback-empty');
    expect(result.embedding.length).toBe(384);
  });

  it('generateEmbedding produces normalized vector', async () => {
    const result = await generateEmbedding('test normalization vector');
    const norm = Math.sqrt(result.embedding.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 1); // Should be approximately 1 (unit vector)
  });
});

// ═══ 7. voiceService ═══
import { DEFAULT_VOICE_CONFIG } from '@/services/voiceService';

describe('voiceService', () => {
  it('DEFAULT_VOICE_CONFIG has correct defaults', () => {
    expect(DEFAULT_VOICE_CONFIG.language).toBe('pt-BR');
    expect(DEFAULT_VOICE_CONFIG.speed).toBe(1.0);
    expect(DEFAULT_VOICE_CONFIG.ttsProvider).toBe('browser');
    expect(DEFAULT_VOICE_CONFIG.sttProvider).toBe('browser');
  });
});

// ═══ 8. workflowEngine (topological sort via executeWorkflow edge case) ═══
import { executeWorkflow } from '@/services/workflowEngine';

describe('workflowEngine', () => {
  it('executeWorkflow with 0 nodes returns failed', async () => {
    const result = await executeWorkflow('test', [], [], 'input');
    expect(result.status).toBe('failed');
    expect(result.finalOutput).toBe('No steps found');
  });
});

// ═══ 9. cicdService ═══
import { generateSDKCode, addTrigger, getTriggers, fireTrigger, shouldCache, DEFAULT_CACHE_CONFIG } from '@/services/cicdService';

describe('cicdService', () => {
  it('generateSDKCode produces npm/python/curl', () => {
    const sdk = generateSDKCode('agent-1', 'Test Agent', 'https://api.example.com');
    expect(sdk.npm).toContain('agent-1');
    expect(sdk.python).toContain('agent-1');
    expect(sdk.curl).toContain('agent-1');
  });

  it('addTrigger and getTriggers', () => {
    addTrigger({ name: 'Test Cron', type: 'cron', schedule: '0 9 * * *', agentId: 'a1', enabled: true });
    const triggers = getTriggers('a1');
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0].name).toBe('Test Cron');
  });

  it('fireTrigger increments count', () => {
    const triggers = getTriggers();
    const t = triggers[triggers.length - 1];
    const before = t.triggerCount;
    fireTrigger(t.id);
    expect(t.triggerCount).toBe(before + 1);
  });

  it('shouldCache excludes sensitive queries', () => {
    expect(shouldCache('normal query')).toBe(true);
    expect(shouldCache('my password is 123')).toBe(false);
    expect(shouldCache('api key sk-123')).toBe(false);
  });
});
