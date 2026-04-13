/**
 * Nexus Agents Studio — Knowledge Service
 * Collections, documents, chunks management for Super Cérebro.
 */
import { supabase } from '@/integrations/supabase/client';
import { invokeTracedFunction } from '@/services/llmGatewayService';

export async function listCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('*, documents:documents(count)')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createCollection(name: string, description?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

export async function searchKnowledge(
  query: string,
  options?: {
    collectionIds?: string[];
    topK?: number;
    threshold?: number;
  },
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cerebro-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
  // Count documents in this collection
  const docsResult = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: false })
    .eq('collection_id', collectionId);

  const docIds = (docsResult.data ?? []).map((d: { id: string }) => d.id);

  // Count chunks belonging to those documents (not to collectionId directly)
  let chunksCount = 0;
  if (docIds.length > 0) {
    const chunksResult = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .in('document_id', docIds);
    chunksCount = chunksResult.count || 0;
  }

  return {
    documents: docsResult.count || 0,
    chunks: chunksCount,
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
    supabase
      .from('chunks')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_status', 'done'),
    supabase
      .from('chunks')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_status', 'pending'),
    supabase
      .from('chunks')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_status', 'failed'),
  ]);
  return { done: done.count ?? 0, pending: pending.count ?? 0, failed: failed.count ?? 0 };
}

export type { RerankResult, RerankResponse } from './types/knowledgeTypes';
import type { RerankResponse } from './types/knowledgeTypes';

/**
 * Rerank chunks using the rag-rerank edge function.
 * Supports Cohere, HuggingFace BGE, and LLM fallback layers.
 */
export async function rerankChunks(
  query: string,
  chunks: Record<string, unknown>[],
  options?: { topK?: number; knowledgeBaseId?: string },
): Promise<RerankResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-rerank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      query,
      chunks,
      top_k: options?.topK || 5,
      knowledge_base_id: options?.knowledgeBaseId,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as Record<string, string>).error || `Rerank failed (${resp.status})`);
  }

  return resp.json();
}

/** Fetch chunks, optionally filtered by knowledge base */
export async function fetchChunksForRerank(kbId?: string, limit = 50) {
  let query = supabase
    .from('chunks')
    .select('id, content, chunk_index, token_count, document_id, metadata')
    .limit(limit)
    .order('created_at', { ascending: false });

  if (kbId) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, collection_id, collections!inner(knowledge_base_id)')
      .eq('collections.knowledge_base_id', kbId);
    const docIds = (docs || []).map((d: { id: string }) => d.id);
    if (docIds.length === 0) return [];
    query = query.in('document_id', docIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createKnowledgeBaseWithWorkspace(kb: {
  name: string;
  description?: string;
  embedding_model?: string;
}) {
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from('knowledge_bases')
    .insert({
      ...kb,
      workspace_id: member?.workspace_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateKnowledgeBase(
  id: string,
  updates: { name?: string; description?: string; embedding_model?: string },
) {
  const { error } = await supabase.from('knowledge_bases').update(updates).eq('id', id);
  if (error) throw error;
}

export async function createCollectionInKB(kb_id: string, name: string) {
  const { error } = await supabase.from('collections').insert({ name, knowledge_base_id: kb_id });
  if (error) throw error;
}

export async function createDocument(doc: {
  title: string;
  collection_id: string;
  source_type?: string;
  mime_type?: string;
}) {
  const { data, error } = await supabase.from('documents').insert(doc).select().single();
  if (error) throw error;
  return data;
}

export async function invokeRagIngest(body: Record<string, unknown>) {
  return invokeTracedFunction('rag-ingest', body, { spanKind: 'rag' });
}

export async function getDocumentCount(collectionId: string) {
  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('collection_id', collectionId);
  return count ?? 0;
}

export async function getChunkCountForCollection(documentIds: string[]) {
  const { count } = await supabase
    .from('chunks')
    .select('id', { count: 'exact', head: true })
    .in('document_id', documentIds);
  return count ?? 0;
}

export async function getKBHealthStats() {
  const [docs, chunks, colls] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('chunks').select('*', { count: 'exact', head: true }),
    supabase.from('collections').select('*', { count: 'exact', head: true }),
  ]);
  return {
    docCount: docs.count ?? 0,
    chunkCount: chunks.count ?? 0,
    collCount: colls.count ?? 0,
  };
}

export async function createPromptVersion(pv: {
  agent_id: string;
  content: string;
  user_id: string;
  change_summary?: string;
}) {
  const { error } = await supabase.from('prompt_versions').insert(pv);
  if (error) throw error;
}

export async function listPromptVersions(agentId: string) {
  const { data } = await supabase
    .from('prompt_versions')
    .select('id, version, change_summary, is_active')
    .eq('agent_id', agentId)
    .order('version', { ascending: false });
  return data ?? [];
}

export async function listCollectionsForKB(kbId: string) {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('knowledge_base_id', kbId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listChunksForDocuments(docIds: string[], limit = 100) {
  if (docIds.length === 0) return [];
  const { data, error } = await supabase
    .from('chunks')
    .select('*')
    .in('document_id', docIds)
    .order('chunk_index', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createCollectionForKB(kbId: string, name: string, description?: string) {
  const { error } = await supabase
    .from('collections')
    .insert({ name, description, knowledge_base_id: kbId });
  if (error) throw error;
}

export async function deleteDocument(docId: string) {
  await supabase.from('chunks').delete().eq('document_id', docId);
  const { error } = await supabase.from('documents').delete().eq('id', docId);
  if (error) throw error;
}

export async function createDocumentWithIngest(
  doc: { title: string; collection_id: string; source_url?: string | null; source_type?: string },
  content?: string,
) {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      title: doc.title,
      collection_id: doc.collection_id,
      source_url: doc.source_url || null,
      source_type: doc.source_type || 'manual',
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw error || new Error('Failed to create document');

  let ingestResult = null;
  if (content?.trim()) {
    ingestResult = await invokeTracedFunction(
      'rag-ingest',
      { document_id: data.id, content: content.trim(), chunk_size: 1000, chunk_overlap: 200 },
      { spanKind: 'rag' },
    );
  }
  return { docId: data.id, ingestResult };
}

export async function updateKBCounts(kbId: string, docCount: number, chunkCount: number) {
  await supabase
    .from('knowledge_bases')
    .update({ document_count: docCount, chunk_count: chunkCount })
    .eq('id', kbId);
}

// ─────────────────────────────────────────────
// Document OCR (doc-ocr Edge Function)
// ─────────────────────────────────────────────

export type DocOcrAction = 'ocr' | 'describe' | 'extract_table' | 'extract_fields';

export interface DocOcrOptions {
  action?: DocOcrAction;
  imageBase64?: string;
  imageUrl?: string;
  prompt?: string;
  fields?: string[];
}

export interface DocOcrResult {
  text: string;
  action: DocOcrAction;
  model: string;
}

/**
 * Invokes the doc-ocr Edge Function (IBM Granite Vision 3.3-2b).
 * Routes between full-text OCR, descriptive analysis, table extraction
 * and structured field extraction.
 */
export async function runDocOcr(opts: DocOcrOptions): Promise<DocOcrResult> {
  if (!opts.imageBase64 && !opts.imageUrl) {
    throw new Error('Forneça imageBase64 ou imageUrl');
  }
  return invokeTracedFunction<DocOcrResult>(
    'doc-ocr',
    {
      action: opts.action ?? 'ocr',
      image_base64: opts.imageBase64,
      image_url: opts.imageUrl,
      prompt: opts.prompt,
      fields: opts.fields,
    },
    {
      spanKind: 'tool',
      extractModel: () => 'ibm-granite-vision-3.3-2b',
    },
  );
}
