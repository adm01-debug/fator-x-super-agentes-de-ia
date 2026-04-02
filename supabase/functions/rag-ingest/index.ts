import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple text chunker
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
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

// Generate embeddings via OpenAI-compatible API
async function generateEmbeddings(texts: string[], apiKey: string, model: string = 'text-embedding-3-small'): Promise<number[][]> {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: texts }),
  });
  const result = await resp.json();
  if (result.error) throw new Error(result.error.message);
  return result.data.map((d: any) => d.embedding);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { document_id, content, chunk_size = 1000, chunk_overlap = 200 } = body;

    if (!document_id || !content) {
      return new Response(JSON.stringify({ error: 'document_id and content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update document status
    await supabase.from('documents').update({ status: 'processing' }).eq('id', document_id);

    // Chunk
    const chunks = chunkText(content, chunk_size, chunk_overlap);

    // Insert chunks
    const chunkRows = chunks.map((c, i) => ({
      document_id, content: c, chunk_index: i,
      token_count: Math.ceil(c.length / 4),
      embedding_status: 'pending',
    }));
    const { data: insertedChunks, error: insertError } = await supabase.from('chunks').insert(chunkRows).select('id, content');
    if (insertError) throw insertError;

    // Try to generate embeddings (needs OpenAI key)
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    let embeddingsGenerated = 0;

    if (member?.workspace_id) {
      const { data: secret } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', member.workspace_id).eq('key_name', 'openai_api_key').single();

      if (secret?.key_value && insertedChunks) {
        try {
          const batchSize = 20;
          for (let i = 0; i < insertedChunks.length; i += batchSize) {
            const batch = insertedChunks.slice(i, i + batchSize);
            const embeddings = await generateEmbeddings(batch.map(c => c.content), secret.key_value);
            for (let j = 0; j < batch.length; j++) {
              await supabase.from('chunks').update({
                embedding: JSON.stringify(embeddings[j]),
                embedding_status: 'done',
              }).eq('id', batch[j].id);
              embeddingsGenerated++;
            }
          }
        } catch (e: any) {
          console.error('Embedding failed:', e.message);
          // Mark remaining as failed
          await supabase.from('chunks').update({ embedding_status: 'failed' }).eq('document_id', document_id).eq('embedding_status', 'pending');
        }
      }
    }

    // Update document and knowledge base counts
    await supabase.from('documents').update({ status: 'indexed', size_bytes: content.length }).eq('id', document_id);

    // Update KB counts
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
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
