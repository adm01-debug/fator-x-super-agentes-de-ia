import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn().mockResolvedValue({
  data: { embeddings: [[0.1, 0.2, 0.3]], results: [], total_candidates: 0 },
  error: null,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

vi.mock('@/integrations/supabase/externalClient', () => ({
  supabaseExternal: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

describe('ragPipelineService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('embedTexts calls rag-embed-v2', async () => {
    const { embedTexts } = await import('@/services/ragPipelineService');
    const result = await embedTexts(['hello world']);
    expect(mockInvoke).toHaveBeenCalledWith('rag-embed-v2', expect.objectContaining({
      body: expect.objectContaining({ texts: ['hello world'] }),
    }));
    expect(result).toHaveProperty('embeddings');
  });

  it('rerankDocuments calls rag-rerank-v2', async () => {
    const { rerankDocuments } = await import('@/services/ragPipelineService');
    await rerankDocuments('query', [{ id: '1', content: 'test' }], 3);
    expect(mockInvoke).toHaveBeenCalledWith('rag-rerank-v2', expect.objectContaining({
      body: expect.objectContaining({ query: 'query', top_k: 3 }),
    }));
  });

  it('invokeRagRerank calls rag-rerank v1', async () => {
    const { invokeRagRerank } = await import('@/services/ragPipelineService');
    const result = await invokeRagRerank({ query: 'test', chunks: [{ content: 'x' }] });
    expect(result).toBeDefined();
  });

  it('throws on embed error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'embed fail' } });
    const { embedTexts } = await import('@/services/ragPipelineService');
    await expect(embedTexts(['test'])).rejects.toThrow('Embed error');
  });

  it('throws on rerank error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'rerank fail' } });
    const { rerankDocuments } = await import('@/services/ragPipelineService');
    await expect(rerankDocuments('q', [{ id: '1', content: 'c' }])).rejects.toThrow('Rerank error');
  });
});
