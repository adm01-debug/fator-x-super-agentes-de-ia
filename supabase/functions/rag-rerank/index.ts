import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { query, chunks, top_k, knowledge_base_id } = await req.json();
    if (!query || !chunks || !Array.isArray(chunks)) {
      return new Response(JSON.stringify({ error: 'query and chunks[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const topK = top_k || 5;
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    // Try Cohere Rerank API first
    let reranked: Array<{ chunk: any; relevance_score: number }> | null = null;

    if (wsId) {
      const { data: cohereKey } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'cohere_api_key').single();
      if (cohereKey?.key_value) {
        try {
          const resp = await fetch('https://api.cohere.ai/v1/rerank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cohereKey.key_value}` },
            body: JSON.stringify({
              model: 'rerank-v3.5',
              query,
              documents: chunks.map((c: any) => c.content || c.text || c),
              top_n: topK,
              return_documents: false,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            reranked = (data.results || []).map((r: any) => ({
              chunk: chunks[r.index],
              relevance_score: r.relevance_score,
            }));
          }
        } catch (e: unknown) { console.error('Cohere rerank failed:', e instanceof Error ? e.message : e); }
      }
    }

    // Fallback: LLM-based reranking via Gateway
    if (!reranked) {
      try {
        const chunkList = chunks.slice(0, 20).map((c: any, i: number) => `[${i}] ${(c.content || c.text || c).substring(0, 300)}`).join('\n\n');
        const resp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            messages: [
              { role: 'system', content: 'You are a relevance ranker. Given a query and numbered passages, return ONLY a JSON array of the most relevant passage indices, ordered by relevance. Example: [3, 7, 1, 5]' },
              { role: 'user', content: `Query: "${query}"\n\nPassages:\n${chunkList}\n\nReturn the top ${topK} most relevant indices as a JSON array.` },
            ],
            temperature: 0, max_tokens: 200,
          }),
        });
        const data = await resp.json();
        const content = (data.content || '').replace(/```json\n?|```/g, '').trim();
        const indices: number[] = JSON.parse(content);
        reranked = indices.slice(0, topK).map((idx, rank) => ({
          chunk: chunks[idx] || chunks[0],
          relevance_score: 1 - (rank * 0.1), // synthetic score
        }));
      } catch { /* last resort: return original order */ }
    }

    // If all reranking failed, return original top K
    if (!reranked) {
      reranked = chunks.slice(0, topK).map((c: any, i: number) => ({
        chunk: c,
        relevance_score: 1 - (i * 0.05),
      }));
    }

    return new Response(JSON.stringify({
      reranked,
      method: reranked?.[0]?.relevance_score > 0.5 ? 'cohere' : 'llm_fallback',
      query,
      total_input: chunks.length,
      top_k: topK,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
