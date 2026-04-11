/**
 * Nexus Agents Studio — Super Cérebro Service
 * Enterprise Memory Layer: collections, graph, facts, health.
 */
import { supabase } from '@/integrations/supabase/client';

export async function getHealthScore() {
  const [docsResult, chunksResult, collectionsResult] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('chunks').select('*', { count: 'exact', head: true }),
    supabase.from('collections').select('*', { count: 'exact', head: true }),
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cerebro-brain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
  if (error) throw error;
  return data ?? [];
}

const CEREBRO_TIMEOUT = 60_000;

async function invokeWithTimeout(fn: string, body: Record<string, unknown>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CEREBRO_TIMEOUT);
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body, signal: ctrl.signal as AbortSignal });
    if (error) throw error;
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error(`${fn} timeout`);
    throw e;
  } finally { clearTimeout(t); }
}

/** Invoke cerebro-brain edge function */
export async function invokeCerebroBrain(body: Record<string, unknown>) {
  return invokeWithTimeout('cerebro-brain', body);
}

/** Invoke cerebro-query edge function */
export async function invokeCerebroQuery(body: Record<string, unknown>) {
  return invokeWithTimeout('cerebro-query', body);
}
