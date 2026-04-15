/**
 * Nexus Agents Studio — Super Cérebro Service
 * Enterprise Memory Layer: collections, graph, facts, health.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { fromTable } from '@/lib/supabaseExtended';

export async function getHealthScore() {
  const [docsResult, chunksResult, collectionsResult] = await Promise.all([
    supabaseExternal.from('documents').select('*', { count: 'exact', head: true }),
    supabaseExternal.from('chunks').select('*', { count: 'exact', head: true }),
    supabaseExternal.from('collections').select('*', { count: 'exact', head: true }),
  ]);

  const docs = docsResult.count || 0;
  const chunks = chunksResult.count || 0;
  const collections = collectionsResult.count || 0;

  // Simple health score based on content volume
  let score = 0;
  if (collections > 0) score += 20;
  if (docs > 0) score += 20;
  if (chunks > 0) score += 20;
  if (docs > 10) score += 15;
  if (chunks > 100) score += 15;
  if (collections > 3) score += 10;

  return { score: Math.min(100, score), docs, chunks, collections };
}

export async function queryBrain(query: string, options?: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cerebro-brain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ query, ...options }),
  });

  if (!resp.ok) throw new Error('Brain query failed');
  return resp.json();
}

export async function getMemories(options?: { type?: string; limit?: number }) {
  let query = supabase
    .from('agent_memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  if (options?.type) query = query.eq('memory_type', options.type);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Invoke cerebro-brain edge function */
export async function invokeCerebroBrain(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('cerebro-brain', { body });
  if (error) throw error;
  return data;
}

/** Invoke cerebro-query edge function */
export async function invokeCerebroQuery(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('cerebro-query', { body });
  if (error) throw error;
  return data;
}

// ============================================================================
// KNOWLEDGE AREAS — domain breakdown for SuperCerebro KnowledgeAreasTab
// ============================================================================

export interface KnowledgeAreaStats {
  domain: string;
  documents: number;
  chunks: number;
  knowledge_bases: number;
  last_updated_at: string | null;
}

/**
 * Aggregates documents/chunks/KBs by domain (knowledge area) so the
 * SuperCerebro KnowledgeAreasTab shows real numbers instead of static
 * placeholders. Maps the 8 canonical Promo Brindes domains.
 *
 * Resilient to missing tables/columns: returns zeros instead of throwing
 * because Super Cérebro tabs render even when the underlying schema is
 * partially set up.
 */
export async function getKnowledgeAreaStats(): Promise<Record<string, KnowledgeAreaStats>> {
  const domains = [
    'processos',
    'dados',
    'rh',
    'financeiro',
    'compras',
    'produtos',
    'comercial',
    'juridico',
  ];

  const result: Record<string, KnowledgeAreaStats> = {};

  for (const domain of domains) {
    const empty: KnowledgeAreaStats = {
      domain,
      documents: 0,
      chunks: 0,
      knowledge_bases: 0,
      last_updated_at: null,
    };

    try {
      // Count knowledge bases tagged with this domain
      const { count: kbCount } = await fromTable('knowledge_bases')
        .select('*', { count: 'exact', head: true })
        .eq('domain', domain);

      // Count documents linked to KBs in this domain (best-effort)
      const { data: kbsInDomain } = await fromTable('knowledge_bases')
        .select('id')
        .eq('domain', domain);

      const kbIds = ((kbsInDomain ?? []) as Array<{ id: string }>).map((r) => r.id);

      let docCount = 0;
      let chunkCount = 0;
      let lastUpdated: string | null = null;

      if (kbIds.length > 0) {
        const { count: dCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .in('knowledge_base_id', kbIds);
        docCount = dCount ?? 0;

        const { count: cCount } = await supabase
          .from('chunks')
          .select('*', { count: 'exact', head: true })
          .in('knowledge_base_id', kbIds);
        chunkCount = cCount ?? 0;

        const { data: latestDoc } = await supabase
          .from('documents')
          .select('updated_at')
          .in('knowledge_base_id', kbIds)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        lastUpdated = (latestDoc as { updated_at?: string } | null)?.updated_at ?? null;
      }

      result[domain] = {
        domain,
        documents: docCount,
        chunks: chunkCount,
        knowledge_bases: kbCount ?? 0,
        last_updated_at: lastUpdated,
      };
    } catch {
      result[domain] = empty;
    }
  }

  return result;
}
