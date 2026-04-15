/**
 * Context Tiers Service — L0/L1/L2 hierarchical context management
 * Inspired by OpenViking (ByteDance, 20K+ stars)
 *
 * L0 (Abstract): ~100 tokens — one-sentence summary for relevance check
 * L1 (Overview): ~2K tokens — structure and key points for planning
 * L2 (Details): Full content — loaded on demand
 *
 * NOTE: Columns l0_abstract, l1_overview, collection_id on chunks and
 * RPC search_context_l0 are planned for future migration.
 */

import { supabaseExternal } from '@/integrations/supabase/externalClient';

export interface ContextTier {
  chunk_id: string;
  document_id: string;
  collection_id: string;
  l0_abstract: string;
  l1_overview: string;
  l2_content: string;
  token_count: number;
  relevance_score?: number;
}

// Phase 1: Search L0 abstracts for quick relevance filtering
export async function searchL0(query: string, collectionId?: string, limit = 20): Promise<ContextTier[]> {
  const { data, error } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(
    'search_context_l0', {
      p_query: query,
      p_collection_id: collectionId || null,
      p_limit: limit,
    }
  );
  if (error) throw error;
  return (data ?? []) as unknown as ContextTier[];
}

// Phase 2: Load L1 overviews for top-K results (planning phase)
export async function loadL1(chunkIds: string[]): Promise<ContextTier[]> {
  const { data, error } = await supabase
    .from('chunks')
    .select('id, document_id, token_count, content, metadata')
    .in('id', chunkIds);
  if (error) throw error;
  return (data ?? []).map(c => ({
    chunk_id: c.id,
    document_id: c.document_id ?? '',
    collection_id: ((c.metadata as Record<string, unknown>)?.collection_id as string) ?? '',
    l0_abstract: (c.content ?? '').substring(0, 200),
    l1_overview: (c.content ?? '').substring(0, 2000),
    l2_content: '',
    token_count: c.token_count ?? 0,
  }));
}

// Phase 3: Load L2 full content for final context (only what's needed)
export async function loadL2(chunkIds: string[]): Promise<ContextTier[]> {
  const { data, error } = await supabase
    .from('chunks')
    .select('id, document_id, content, token_count, metadata')
    .in('id', chunkIds);
  if (error) throw error;
  return (data ?? []).map(c => ({
    chunk_id: c.id,
    document_id: c.document_id ?? '',
    collection_id: ((c.metadata as Record<string, unknown>)?.collection_id as string) ?? '',
    l0_abstract: (c.content ?? '').substring(0, 200),
    l1_overview: (c.content ?? '').substring(0, 2000),
    l2_content: c.content ?? '',
    token_count: c.token_count ?? 0,
  }));
}

// Tiered search: L0 filter → L1 plan → L2 detail (saves ~80% tokens)
export async function tieredSearch(
  query: string,
  collectionId?: string,
  options?: { l0Limit?: number; l1Limit?: number; l2Limit?: number }
): Promise<{ l0Results: number; l1Results: number; l2Results: ContextTier[]; tokensSaved: number }> {
  const { l0Limit = 20, l1Limit = 10, l2Limit = 5 } = options || {};

  const l0 = await searchL0(query, collectionId, l0Limit);
  const topIds = l0.slice(0, l1Limit).map(c => c.chunk_id);
  const l1 = topIds.length > 0 ? await loadL1(topIds) : [];
  const finalIds = l1.slice(0, l2Limit).map(c => c.chunk_id);
  const l2 = finalIds.length > 0 ? await loadL2(finalIds) : [];

  const totalTokensWithoutTiers = l0.reduce((sum, c) => sum + (c.token_count || 500), 0);
  const totalTokensWithTiers = l2.reduce((sum, c) => sum + c.token_count, 0) +
    l1.length * 200 + l0.length * 10;
  const tokensSaved = Math.max(0, totalTokensWithoutTiers - totalTokensWithTiers);

  return { l0Results: l0.length, l1Results: l1.length, l2Results: l2, tokensSaved };
}

export async function generateTiers(content: string): Promise<{ l0: string; l1: string }> {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const l0 = sentences[0]?.trim().substring(0, 200) || content.substring(0, 200);
  const l1 = sentences.slice(0, 10).join('. ').substring(0, 2000);
  return { l0, l1 };
}
