/**
 * Nexus Agents Studio — Knowledge Service
 * Collections, documents, chunks management for Super Cérebro.
 */
import { supabase } from '@/integrations/supabase/client';

export async function listCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('*, documents:documents(count)')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createCollection(name: string, description?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('collections')
    .insert({ name, description })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
}

export async function listDocuments(collectionId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function searchKnowledge(query: string, options?: {
  collectionIds?: string[];
  topK?: number;
  threshold?: number;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cerebro-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      query,
      collection_ids: options?.collectionIds,
      top_k: options?.topK || 10,
      threshold: options?.threshold || 0.7,
    }),
  });

  if (!resp.ok) throw new Error('Knowledge search failed');
  return resp.json();
}

export async function getCollectionStats(collectionId: string) {
  const [docsResult, chunksResult] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('collection_id', collectionId),
    supabase.from('chunks').select('*', { count: 'exact', head: true }).eq('document_id', collectionId),
  ]);

  return {
    documents: docsResult.count || 0,
    chunks: chunksResult.count || 0,
  };
}

export async function listKnowledgeBases() {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteKnowledgeBase(id: string) {
  const { error } = await supabase.from('knowledge_bases').delete().eq('id', id);
  if (error) throw error;
}

export async function listVectorIndexes() {
  const { data } = await supabase
    .from('vector_indexes')
    .select('*, knowledge_bases(name)')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getChunkEmbeddingStats() {
  const [done, pending, failed] = await Promise.all([
    supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'done'),
    supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'pending'),
    supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'failed'),
  ]);
  return { done: done.count ?? 0, pending: pending.count ?? 0, failed: failed.count ?? 0 };
}
