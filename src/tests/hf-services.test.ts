import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

describe('nlpPipelineService', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('analyzeText returns NER + sentiment', async () => {
    const mockResult = {
      ner: { entities: [{ type: 'EMAIL', value: 'a@b.com', confidence: 0.95 }], structured_order: {}, entity_count: 1 },
      sentiment: { label: 'neutral', score: 0.5, emoji: '😐' },
      processing_time_ms: 2,
      version: 'v2.4',
    };
    mockInvoke.mockResolvedValue({ data: mockResult, error: null });

    const { analyzeText } = await import('@/services/nlpPipelineService');
    const result = await analyzeText('test@email.com', ['ner', 'sentiment']);

    expect(result.ner?.entity_count).toBe(1);
    expect(result.sentiment?.label).toBe('neutral');
    expect(mockInvoke).toHaveBeenCalledWith('nlp-pipeline', expect.objectContaining({ body: expect.objectContaining({ text: 'test@email.com' }) }));
  });

  it('analyzeText throws on error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'timeout' } });

    const { analyzeText } = await import('@/services/nlpPipelineService');
    await expect(analyzeText('test')).rejects.toThrow();
  });
});

describe('guardrailsMLService', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('checkInput returns allowed/blocked', async () => {
    const mockResult = { allowed: true, direction: 'input', results: [], blocked_count: 0, version: 'v2.5' };
    mockInvoke.mockResolvedValue({ data: mockResult, error: null });

    const { checkInput } = await import('@/services/guardrailsMLService');
    const result = await checkInput('hello');

    expect(result.allowed).toBe(true);
    expect(result.direction).toBe('input');
  });

  it('checkOutput returns results with layers', async () => {
    const mockResult = {
      allowed: false, direction: 'output',
      results: [{ layer: 'pii_leak', passed: false, score: 0.8, details: 'PII detected: CPF' }],
      blocked_count: 1, version: 'v2.5',
    };
    mockInvoke.mockResolvedValue({ data: mockResult, error: null });

    const { checkOutput } = await import('@/services/guardrailsMLService');
    const result = await checkOutput('CPF 123.456.789-00');

    expect(result.allowed).toBe(false);
    expect(result.blocked_count).toBe(1);
  });

  it('isTextSafe returns boolean', async () => {
    mockInvoke.mockResolvedValue({ data: { allowed: true, direction: 'input', results: [], blocked_count: 0, version: 'v2.5' }, error: null });

    const { isTextSafe } = await import('@/services/guardrailsMLService');
    const safe = await isTextSafe('clean text');

    expect(safe).toBe(true);
  });
});

describe('modelRouterService', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('routeQuery returns model recommendation', async () => {
    const mockResult = {
      recommended_model: 'youtu-llm-1.96b', tier: 'nano',
      estimated_cost_per_query: 0.000013,
      complexity: { level: 'simple', score: 0, factors: [] },
      alternatives: [],
    };
    mockInvoke.mockResolvedValue({ data: mockResult, error: null });

    const { routeQuery } = await import('@/services/modelRouterService');
    const result = await routeQuery('Oi');

    expect(result.recommended_model).toBe('youtu-llm-1.96b');
    expect(result.tier).toBe('nano');
  });
});

describe('ragPipelineService', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('embedTexts returns EmbedResult', async () => {
    const mockResult = { embeddings: [[0.1, 0.2]], model: 'bge-m3', dimension: 2, count: 1, processing_time_ms: 5 };
    mockInvoke.mockResolvedValue({ data: mockResult, error: null });

    const { embedTexts } = await import('@/services/ragPipelineService');
    const result = await embedTexts(['test']);

    expect(result.count).toBe(1);
    expect(result.embeddings).toHaveLength(1);
  });

  it('rerankDocuments returns RerankResult', async () => {
    const mockResult = {
      results: [{ id: '1', content: 'doc', original_score: 0.5, rerank_score: 0.9 }],
      total_candidates: 1, returned: 1, model: 'bge', processing_time_ms: 3,
    };
    mockInvoke.mockResolvedValue({ data: mockResult, error: null });

    const { rerankDocuments } = await import('@/services/ragPipelineService');
    const result = await rerankDocuments('query', [{ id: '1', content: 'doc' }]);

    expect(result.returned).toBe(1);
    expect(result.results[0].rerank_score).toBe(0.9);
  });
});

describe('evalEngineService', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('runRAGASEvaluation returns RAGAS metrics', async () => {
    const mockResult = {
      ragas: { faithfulness: 0.9, answer_relevancy: 0.8, context_precision: 0.7, context_recall: 0.85, answer_correctness: 0.75, overall_score: 0.8, sample_count: 1 },
    };
    mockInvoke.mockResolvedValue({ data: mockResult, error: null });

    const { runRAGASEvaluation } = await import('@/services/evalEngineService');
    const result = await runRAGASEvaluation('ws1', 'agent1', [
      { query: 'test', answer: 'ans', contexts: ['ctx'] },
    ]);

    expect(result.ragas.overall_score).toBe(0.8);
    expect(result.ragas.sample_count).toBe(1);
  });
});
