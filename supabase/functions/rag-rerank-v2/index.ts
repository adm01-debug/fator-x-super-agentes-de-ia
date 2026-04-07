/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — RAG Rerank v2
 * ═══════════════════════════════════════════════════════════════
 * Neural reranking for RAG pipelines. Takes a query and N candidate
 * documents, returns top_k reordered by relevance.
 *
 * Strategy (graceful fallback chain):
 *   1. Cohere Rerank API (rerank-v3.5) — best quality if key present
 *   2. HuggingFace cross-encoder via Inference API
 *      (BAAI/bge-reranker-v2-m3 or Qwen3-Reranker-8B)
 *   3. BM25-like lexical fallback (zero deps, deterministic)
 *
 * Differs from v1 (rag-rerank): accepts a `documents` array with
 * id+content+score (matching ragPipelineService contract) and supports
 * Qwen3-Reranker-8B as new flagship model.
 *
 * Used by: src/services/ragPipelineService.ts → rerankDocuments()
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

// ═══ Input Schema ═══
const RerankInput = z.object({
  query: z.string().min(1).max(2000),
  documents: z.array(z.object({
    id: z.string(),
    content: z.string().min(1).max(8000),
    score: z.number().optional(),
  })).min(1).max(200),
  top_k: z.number().int().min(1).max(50).default(5),
  model: z.string().optional().default('qwen3-reranker-8b'),
});

const HF_RERANKER_MAP: Record<string, string> = {
  'qwen3-reranker-8b': 'Qwen/Qwen3-Reranker-8B',
  'bge-reranker-v2-m3': 'BAAI/bge-reranker-v2-m3',
  'bge-reranker-large': 'BAAI/bge-reranker-large',
};

// ═══ Cohere Reranker ═══
async function rerankWithCohere(
  query: string,
  documents: Array<{ id: string; content: string }>,
  topK: number,
  cohereKey: string,
): Promise<Array<{ id: string; content: string; relevance_score: number }> | null> {
  try {
    const resp = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cohereKey}`,
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query,
        documents: documents.map(d => d.content),
        top_n: topK,
        return_documents: false,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.results as Array<{ index: number; relevance_score: number }>).map(r => ({
      id: documents[r.index].id,
      content: documents[r.index].content,
      relevance_score: r.relevance_score,
    }));
  } catch {
    return null;
  }
}

// ═══ HuggingFace Cross-Encoder ═══
async function rerankWithHF(
  query: string,
  documents: Array<{ id: string; content: string }>,
  topK: number,
  modelId: string,
  hfKey: string,
): Promise<Array<{ id: string; content: string; relevance_score: number }> | null> {
  try {
    const url = `https://api-inference.huggingface.co/models/${modelId}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          source_sentence: query,
          sentences: documents.map(d => d.content),
        },
        options: { wait_for_model: true },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data)) return null;
    const scored = (data as number[]).map((score, i) => ({
      id: documents[i].id,
      content: documents[i].content,
      relevance_score: score,
    }));
    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    return scored.slice(0, topK);
  } catch {
    return null;
  }
}

// ═══ BM25-like Lexical Fallback ═══
function rerankBM25(
  query: string,
  documents: Array<{ id: string; content: string; score?: number }>,
  topK: number,
): Array<{ id: string; content: string; relevance_score: number }> {
  // Simple BM25 with k1=1.5, b=0.75
  const k1 = 1.5;
  const b = 0.75;

  const tokenize = (s: string): string[] =>
    s.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);

  const queryTokens = tokenize(query);
  const N = documents.length;
  const docTokens = documents.map(d => tokenize(d.content));
  const avgLen = docTokens.reduce((s, t) => s + t.length, 0) / N || 1;

  // IDF per query token
  const idf: Record<string, number> = {};
  for (const qt of queryTokens) {
    let df = 0;
    for (const dt of docTokens) if (dt.includes(qt)) df++;
    idf[qt] = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }

  const scored = documents.map((doc, i) => {
    const tokens = docTokens[i];
    const docLen = tokens.length || 1;
    let score = 0;
    for (const qt of queryTokens) {
      const tf = tokens.filter(t => t === qt).length;
      if (tf === 0) continue;
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLen / avgLen));
      score += (idf[qt] || 0) * (numerator / denominator);
    }
    // Blend with original vector score if present
    const blended = doc.score !== undefined ? 0.6 * score + 0.4 * (doc.score * 5) : score;
    return { id: doc.id, content: doc.content, relevance_score: blended };
  });

  scored.sort((a, b) => b.relevance_score - a.relevance_score);
  return scored.slice(0, topK);
}

// ═══ Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, RerankInput);
    if (parsed.error) return parsed.error;
    const { query, documents, top_k, model } = parsed.data;

    // Workspace lookup for secrets
    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1);
    const wsId = members?.[0]?.workspace_id;

    let cohereKey: string | undefined;
    let hfKey: string | undefined;
    if (wsId) {
      const { data: secrets } = await supabase
        .from('workspace_secrets')
        .select('key_name, key_value')
        .eq('workspace_id', wsId)
        .in('key_name', ['cohere_api_key', 'huggingface_api_key']);
      for (const s of secrets ?? []) {
        if (s.key_name === 'cohere_api_key') cohereKey = s.key_value;
        if (s.key_name === 'huggingface_api_key') hfKey = s.key_value;
      }
    }
    cohereKey ??= Deno.env.get('COHERE_API_KEY') ?? undefined;
    hfKey ??= Deno.env.get('HUGGINGFACE_API_KEY') ?? undefined;

    let results: Array<{ id: string; content: string; relevance_score: number }> | null = null;
    let usedMethod = 'bm25_fallback';

    // 1. Try Cohere
    if (cohereKey) {
      results = await rerankWithCohere(query, documents, top_k, cohereKey);
      if (results) usedMethod = 'cohere:rerank-v3.5';
    }

    // 2. Try HuggingFace
    if (!results && hfKey) {
      const hfModel = HF_RERANKER_MAP[model] ?? HF_RERANKER_MAP['bge-reranker-v2-m3'];
      results = await rerankWithHF(query, documents, top_k, hfModel, hfKey);
      if (results) usedMethod = `hf:${hfModel}`;
    }

    // 3. BM25 fallback
    if (!results) {
      results = rerankBM25(query, documents, top_k);
      usedMethod = 'bm25_fallback';
    }

    return jsonResponse(req, {
      results,
      total_candidates: documents.length,
      top_k,
      method_used: usedMethod,
      version: 'rag-rerank-v2.0',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(req, message, 500);
  }
});
