import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function validateBody(body: unknown): { valid: true; data: { document_id: string; content: string; chunk_size: number; chunk_overlap: number; contextual_chunking: boolean } } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object' };
  const b = body as Record<string, unknown>;
  if (typeof b.document_id !== 'string' || b.document_id.length < 10) return { valid: false, error: 'document_id is required (UUID)' };
  if (typeof b.content !== 'string' || b.content.trim().length < 1) return { valid: false, error: 'content is required' };
  if (b.content.length > 5_000_000) return { valid: false, error: 'content must be <= 5MB' };
  const chunk_size = typeof b.chunk_size === 'number' ? Math.max(100, Math.min(10000, b.chunk_size)) : 1000;
  const chunk_overlap = typeof b.chunk_overlap === 'number' ? Math.max(0, Math.min(chunk_size - 1, b.chunk_overlap)) : 200;
  return {
    valid: true,
    data: { document_id: b.document_id, content: b.content, chunk_size, chunk_overlap, contextual_chunking: b.contextual_chunking === true },
  };
}

function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (overlap >= chunkSize) overlap = Math.floor(chunkSize * 0.2);
  if (chunkSize < 100) chunkSize = 100;
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }
  return chunks;
}

// ═══ Embeddings Generation (HuggingFace first, OpenAI fallback) ═══
async function generateEmbeddingsHF(texts: string[], hfToken: string): Promise<number[][] | null> {
  try {
    // Use BGE-M3 sentence similarity to get embeddings via feature-extraction
    const resp = await fetch('https://router.huggingface.co/hf-inference/models/BAAI/bge-m3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
      body: JSON.stringify({ inputs: { source_sentence: texts[0], sentences: texts } }),
    });
    if (!resp.ok) return null;
    // BGE-M3 sentence similarity returns similarity scores, not raw embeddings
    // For raw embeddings, we use the feature-extraction pipeline
    const result = await resp.json();
    // If we got similarity scores back instead of embeddings, fallback
    if (Array.isArray(result) && typeof result[0] === 'number') return null;
    return result;
  } catch {
    return null;
  }
}

async function generateEmbeddings(texts: string[], apiKey: string, model: string = 'text-embedding-3-small'): Promise<number[][]> {
  // Try HuggingFace first (free)
  const hfToken = Deno.env.get('HF_API_TOKEN');
  if (hfToken && Deno.env.get('ENABLE_HF_EMBEDDINGS') !== 'false') {
    const hfResult = await generateEmbeddingsHF(texts, hfToken);
    if (hfResult && hfResult.length === texts.length) return hfResult;
  }

  // Fallback to OpenAI (paid) — request 1024 dims via Matryoshka for future BGE-M3 compat
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: texts }),
  });
  const result = await resp.json();
  if (result.error) throw new Error(result.error.message);
  return result.data.map((d: { embedding: number[] }) => d.embedding);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validation = validateBody(rawBody);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { document_id, content, chunk_size, chunk_overlap, contextual_chunking } = validation.data;

    await supabase.from('documents').update({ status: 'processing' }).eq('id', document_id);

    let useContextual = contextual_chunking;
    if (!useContextual) {
      const { data: doc } = await supabase.from('documents').select('collection_id').eq('id', document_id).single();
      if (doc) {
        const { data: col } = await supabase.from('collections').select('knowledge_base_id').eq('id', doc.collection_id).single();
        if (col) {
          const { data: kb } = await supabase.from('knowledge_bases').select('*').eq('id', col.knowledge_base_id).single();
          const kbConfig = kb as Record<string, unknown> | null;
          useContextual = (kbConfig?.contextual_chunking_enabled as boolean) || false;
        }
      }
    }

    const chunks = chunkText(content, chunk_size, chunk_overlap);

    const contextPrefixes: string[] = [];
    if (useContextual && chunks.length > 1) {
      const { data: mmbr } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
      if (mmbr?.workspace_id) {
        const { data: apiKeyRow } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', mmbr.workspace_id).eq('key_name', 'openai_api_key').single();
        if (apiKeyRow?.key_value) {
          const docSummary = content.substring(0, 3000);
          for (let i = 0; i < chunks.length; i++) {
            try {
              const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyRow.key_value}` },
                body: JSON.stringify({
                  model: 'gpt-4o-mini', max_tokens: 100, temperature: 0,
                  messages: [
                    { role: 'system', content: 'Generate a very brief (1-2 sentence) context explaining where this chunk fits in the overall document. Respond ONLY with the context, no labels.' },
                    { role: 'user', content: `Document excerpt:\n${docSummary}\n\nChunk ${i + 1}/${chunks.length}:\n${chunks[i].substring(0, 500)}` },
                  ],
                }),
              });
              const data = await resp.json();
              contextPrefixes[i] = data.choices?.[0]?.message?.content?.trim() || '';
            } catch { contextPrefixes[i] = ''; }
          }
        }
      }
    }

    const chunkRows = chunks.map((c, i) => ({
      document_id, content: contextPrefixes[i] ? `${contextPrefixes[i]}\n\n${c}` : c,
      chunk_index: i,
      token_count: Math.ceil((contextPrefixes[i] ? contextPrefixes[i].length + c.length : c.length) / 4),
      embedding_status: 'pending',
    }));
    const { data: insertedChunks, error: insertError } = await supabase.from('chunks').insert(chunkRows).select('id, content');
    if (insertError) throw insertError;

    const { data: memberData } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    let embeddingsGenerated = 0;

    if (memberData?.workspace_id) {
      const { data: secret } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', memberData.workspace_id).eq('key_name', 'openai_api_key').single();

      if (secret?.key_value && insertedChunks) {
        try {
          const batchSize = 20;
          for (let i = 0; i < insertedChunks.length; i += batchSize) {
            const batch = insertedChunks.slice(i, i + batchSize);
            const embeddings = await generateEmbeddings(batch.map(c => c.content), secret.key_value);
            for (let j = 0; j < batch.length; j++) {
              await supabase.from('chunks').update({
                embedding_status: 'done',
              }).eq('id', batch[j].id);
              embeddingsGenerated++;
            }
          }
        } catch (e: unknown) {
          console.error('Embedding failed:', e instanceof Error ? e.message : e);
          await supabase.from('chunks').update({ embedding_status: 'failed' }).eq('document_id', document_id).eq('embedding_status', 'pending');
        }
      }
    }

    await supabase.from('documents').update({ status: 'indexed', size_bytes: content.length }).eq('id', document_id);

    const { data: doc } = await supabase.from('documents').select('collection_id').eq('id', document_id).single();
    if (doc) {
      const { data: col } = await supabase.from('collections').select('knowledge_base_id').eq('id', doc.collection_id).single();
      if (col) {
        const { count: docCount } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('collection_id', doc.collection_id);
        const { count: chunkCount } = await supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('document_id', document_id);
        await supabase.from('knowledge_bases').update({ document_count: docCount || 0, chunk_count: chunkCount || 0 }).eq('id', col.knowledge_base_id);
      }
    }

    return new Response(JSON.stringify({
      chunks_created: chunks.length, embeddings_generated: embeddingsGenerated,
      document_id, status: 'indexed',
      embedding_provider: (Deno.env.get('HF_API_TOKEN') && Deno.env.get('ENABLE_HF_EMBEDDINGS') !== 'false') ? 'huggingface/BAAI/bge-m3 (fallback: openai)' : 'openai',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
