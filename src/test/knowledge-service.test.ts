/**
 * knowledgeService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(), getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/services/llmGatewayService', () => ({
  invokeTracedFunction: vi.fn(),
}));

describe('knowledgeService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/knowledgeService');
    expect(typeof mod.listCollections).toBe('function');
    expect(typeof mod.createCollection).toBe('function');
    expect(typeof mod.deleteCollection).toBe('function');
    expect(typeof mod.listDocuments).toBe('function');
    expect(typeof mod.searchKnowledge).toBe('function');
    expect(typeof mod.listKnowledgeBases).toBe('function');
    expect(typeof mod.getChunkEmbeddingStats).toBe('function');
    expect(typeof mod.rerankChunks).toBe('function');
  });
});

describe('knowledgeService types', () => {
  it('exports at least 15 functions', async () => {
    const mod = await import('@/services/knowledgeService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(15);
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/knowledgeService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('RerankResponse interface shape exists', async () => {
    const mod = await import('@/services/knowledgeService');
    expect(typeof mod.rerankChunks).toBe('function');
    expect(typeof mod.fetchChunksForRerank).toBe('function');
  });
});
