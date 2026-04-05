import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

// ═══ Input Schema (Zod) ═══
const RerankInput = z.object({
  query: z.string().min(1).max(2000),
  chunks: z.array(z.record(z.unknown())).min(1).max(200),
  top_k: z.number().int().min(1).max(50).default(5),
  knowledge_base_id: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    // ═══ Auth ═══
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    // ═══ Rate Limiting ═══
    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    // ═══ Validate Input ═══
    const parsed = await parseBody(req, RerankInput);
    if (parsed.error) return parsed.error;
    const { query, chunks, top_k: topK } = parsed.data;

    // ═══ Workspace lookup ═══
    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1);
    const wsId = members?.[0]?.workspace_id;

    // ═══ Reranking Pipeline (3 layers) ═══
    let reranked: Array<{ chunk: Record<string, unknown>; relevance_score: number }> | null = null;
    let usedMethod = 'original_order';

    // Layer 1: Cohere Rerank API
    try {
      if (wsId) {
        const { data: secrets } = await supabase
          .from('workspace_secrets')
          .select('key_value')
          .eq('workspace_id', wsId)
          .eq('key_name', 'cohere_api_key')
          .limit(1);
        const cohereKeyValue = secrets?.[0]?.key_value;

        if (cohereKeyValue) {
          const resp = await fetch('https://api.cohere.ai/v1/rerank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cohereKeyValue}` },
            body: JSON.stringify({
              model: 'rerank-v3.5',
              query,
              documents: chunks.map((c: Record<string, unknown>) => c.content || c.text || c),
              top_n: topK,
              return_documents: false,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            reranked = (data.results || []).map((r: Record<string, unknown>) => ({
              chunk: chunks[r.index as number],
              relevance_score: r.relevance_score as number,
            }));
            if (reranked.length > 0) usedMethod = 'cohere';
          }
        }
      }
    } catch (e: unknown) {
      console.error('Cohere layer failed:', e instanceof Error ? e.message : e);
    }

    // Layer 2: HuggingFace BGE Reranker (free cross-encoder)
    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!reranked && hfToken && Deno.env.get('ENABLE_HF_RERANKER') !== 'false') {
      try {
        const pairs = chunks.slice(0, 30).map((c: Record<string, unknown>) => ({
          text: query,
          text_pair: String(c.content || c.text || c).substring(0, 512),
        }));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch('https://router.huggingface.co/hf-inference/models/BAAI/bge-reranker-v2-m3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
          body: JSON.stringify({ inputs: pairs }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const scores: unknown = await resp.json();
          if (Array.isArray(scores) && scores.length > 0) {
            const indexed = scores.map((item: unknown, i: number) => {
              const score = typeof item === 'number'
                ? item
                : ((item as Record<string, unknown>)?.[0] as Record<string, number>)?.score
                  ?? (item as Record<string, number>)?.score
                  ?? 0;
              return { chunk: chunks[i], relevance_score: score };
            });
            indexed.sort((a, b) => b.relevance_score - a.relevance_score);
            reranked = indexed.slice(0, topK);
            if (reranked.length > 0) usedMethod = 'hf_bge_reranker';
          }
        }
      } catch (e: unknown) {
        console.error('HF rerank failed:', e instanceof Error ? e.message : e);
      }
    }

    // Layer 3: Skip LLM self-call (causes edge function timeout)
    // Fall through to ultimate fallback

    // Ultimate fallback: original order
    if (!reranked) {
      reranked = chunks.slice(0, topK).map((c: Record<string, unknown>, i: number) => ({
        chunk: c,
        relevance_score: 1 - (i * 0.05),
      }));
    }

    return jsonResponse(req, {
      reranked,
      method: usedMethod,
      query,
      total_input: chunks.length,
      top_k: topK,
    });

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
