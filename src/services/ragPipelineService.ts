/**
 * Nexus — RAG Pipeline Service (Embed v2 + Rerank v2)
 * Two-stage retrieval: vector search → neural reranking.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export async function embedTexts(texts: string[], provider = 'qwen3-embedding-8b', dimension = 1024) {
  const { data, error } = await supabase.functions.invoke('rag-embed-v2', {
    body: { texts, provider, dimension, task: 'retrieval.passage' },
  });
  if (error) {
    logger.error('RAG embed failed', { error: error.message });
    throw new Error(`Embed error: ${error.message}`);
  }
  return data;
}

export async function rerankDocuments(
  query: string,
  documents: Array<{ id: string; content: string; score?: number }>,
  topK = 5
) {
  const { data, error } = await supabase.functions.invoke('rag-rerank-v2', {
    body: { query, documents, top_k: topK, model: 'qwen3-reranker-8b' },
  });
  if (error) {
    logger.error('RAG rerank failed', { error: error.message });
    throw new Error(`Rerank error: ${error.message}`);
  }
  return data;
}

export async function searchAndRerank(query: string, knowledgeBaseId: string, topK = 5) {
  const embedResult = await embedTexts([query], 'qwen3-embedding-8b', 1024);
  const queryEmbedding = (embedResult as Record<string, unknown>)?.embeddings;
  const firstEmbed = Array.isArray(queryEmbedding) ? queryEmbedding[0] : null;
  if (!firstEmbed) throw new Error('Failed to embed query');

  const { data: candidates, error } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)('match_documents', {
    query_embedding: firstEmbed,
    match_threshold: 0.5,
    match_count: 50,
    p_knowledge_base_id: knowledgeBaseId,
  });
  if (error) {
    logger.error('Vector search failed', { error: error.message });
    throw new Error(`Search error: ${error.message}`);
  }

  if (candidates?.length) {
    return rerankDocuments(
      query,
      (candidates as Array<Record<string, unknown>>).map(c => ({
        id: String(c.id),
        content: String(c.content),
        score: Number(c.similarity || 0),
      })),
      topK
    );
  }
  return { results: [], total_candidates: 0 };
}
