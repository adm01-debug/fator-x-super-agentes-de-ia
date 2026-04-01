/**
 * Vector Search Service — pgvector integration for Super Cérebro
 * Supports embedding generation and similarity search.
 * Uses Supabase's pgvector extension for storage and retrieval.
 */
import { type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { callModel, isLLMConfigured } from './llmService';

// ═══ TYPES ═══

export interface SearchResult {
  id: string;
  content: string;
  domain: string;
  confidence: number;
  source: string;
  similarity: number;
  method: 'vector' | 'bm25' | 'graph' | 'hybrid';
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
}

// ═══ EMBEDDING GENERATION ═══

/**
 * Generate embeddings using OpenAI-compatible endpoint.
 * Falls back to simple text hashing for development.
 */
export async function generateEmbedding(
  text: string,
  apiKey?: string
): Promise<EmbeddingResult> {
  // Try real embedding API if key available
  if (apiKey && apiKey.length > 10) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        logger.info(`Embedding generated: ${data.usage?.total_tokens ?? 0} tokens`, 'vectorSearch');
        return {
          embedding: data.data[0].embedding,
          model: 'text-embedding-3-small',
          tokens: data.usage?.total_tokens ?? 0,
        };
      }
    } catch (err) {
      logger.warn(`Embedding API failed, using fallback: ${err instanceof Error ? err.message : 'Unknown'}`, 'vectorSearch');
    }
  }

  // Fallback: Simple hash-based pseudo-embedding (for development)
  const cleanText = text.trim();
  if (!cleanText) {
    // Empty text: return small random vector instead of zero vector (zero vectors break cosine similarity)
    const dim = 384;
    const rng = Array.from({ length: dim }, (_, i) => Math.sin(i * 0.1) * 0.01);
    return { embedding: rng, model: 'fallback-empty', tokens: 0 };
  }
  const words = cleanText.toLowerCase().split(/\s+/).filter(Boolean);
  const dim = 384;
  const embedding = new Array(dim).fill(0);
  words.forEach((word, i) => {
    for (let j = 0; j < word.length; j++) {
      embedding[(word.charCodeAt(j) * (i + 1) + j * 31) % dim] += 1.0 / words.length;
    }
  });
  // Normalize (never returns zero vector due to guard above)
  const norm = Math.sqrt(embedding.reduce((s: number, v: number) => s + v * v, 0));
  if (norm > 0) embedding.forEach((_: number, i: number) => { embedding[i] /= norm; });

  logger.debug(`Fallback embedding: ${words.length} words, dim=${dim}`, 'vectorSearch');
  return { embedding, model: 'fallback-hash', tokens: words.length };
}

// ═══ SIMILARITY SEARCH ═══

/**
 * Search facts in brain_facts table using pgvector similarity.
 * Falls back to text search (ILIKE) if vectors not available.
 */
export async function searchFacts(
  query: string,
  options?: { limit?: number; domain?: string; minConfidence?: number }
): Promise<SearchResult[]> {
  const limit = options?.limit ?? 10;
  const results: SearchResult[] = [];

  // Strategy 1: pgvector similarity search (requires embeddings stored)
  try {
    const { data: vectorResults, error } = await supabase
      .rpc('match_brain_facts', {
        query_text: query,
        match_count: limit,
        min_confidence: options?.minConfidence ?? 50,
      });

    if (!error && vectorResults && vectorResults.length > 0) {
      logger.info(`Vector search: ${vectorResults.length} results`, 'vectorSearch');
      return vectorResults.map((r: { id: string; content: string; domain: string; confidence: number; source_type: string; similarity: number }) => ({
        id: r.id,
        content: r.content,
        domain: r.domain,
        confidence: r.confidence,
        source: r.source_type,
        similarity: r.similarity,
        method: 'vector' as const,
      }));
    }
  } catch (err) {
    logger.debug(`Vector search RPC not available, falling back to text search: ${err instanceof Error ? err.message : ''}`, 'vectorSearch');
  }

  // Strategy 2: Text search (ILIKE) — always works
  try {
    let dbQuery = supabase
      .from('brain_facts')
      .select('id, content, domain, confidence, source_type')
      .ilike('content', `%${query}%`)
      .limit(limit);

    if (options?.domain) {
      dbQuery = dbQuery.eq('domain', options.domain);
    }

    const { data, error } = await dbQuery;
    if (!error && data) {
      logger.info(`Text search: ${data.length} results`, 'vectorSearch');
      data.forEach((r: { id: string; content: string; domain: string; confidence: number; source_type: string }) => {
        results.push({
          id: r.id,
          content: r.content,
          domain: r.domain,
          confidence: r.confidence,
          source: r.source_type,
          similarity: 0.7, // Approximate for text match
          method: 'bm25',
        });
      });
    }
  } catch (err) {
    logger.warn(`Text search failed (table may not exist): ${err instanceof Error ? err.message : ''}`, 'vectorSearch');
  }

  // Strategy 3: LLM-based semantic search (if configured and no results yet)
  if (results.length === 0 && isLLMConfigured()) {
    try {
      const response = await callModel('anthropic/claude-sonnet-4', [
        { role: 'system', content: 'Responda a busca de forma concisa. Se não souber, diga "Sem informação".' },
        { role: 'user', content: `Busca no Super Cérebro: "${query}"` },
      ], { maxTokens: 500 });

      if (!response.error) {
        results.push({
          id: crypto.randomUUID(),
          content: response.content,
          domain: 'llm-search',
          confidence: 60,
          source: 'llm',
          similarity: 0.6,
          method: 'hybrid',
        });
      }
    } catch (err) {
      logger.warn(`LLM search fallback failed: ${err instanceof Error ? err.message : ''}`, 'vectorSearch');
    }
  }

  return results;
}

/**
 * Store a fact with its embedding in brain_facts table.
 */
export async function storeFact(
  content: string,
  domain: string,
  confidence: number,
  sourceType: string,
  apiKey?: string
): Promise<{ id?: string; error?: string }> {
  try {
    const { embedding } = await generateEmbedding(content, apiKey);

    const { data, error } = await supabase
      .from('brain_facts')
      .insert({
        content,
        domain,
        confidence,
        source_type: sourceType,
        embedding: embedding,
      })
      .select('id')
      .single();

    if (error) return { error: error.message };
    logger.info(`Fact stored: "${content.slice(0, 50)}..." domain=${domain}`, 'vectorSearch');
    return { id: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao armazenar fato' };
  }
}
