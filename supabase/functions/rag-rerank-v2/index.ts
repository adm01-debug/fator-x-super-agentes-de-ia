import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY") || Deno.env.get("HF_API_TOKEN") || "";
const VERSION = "v1.2";

const RERANKER_MODELS: Record<string, string> = {
  "qwen3-reranker-8b": "https://router.huggingface.co/hf-inference/models/Qwen/Qwen3-Reranker-8B",
  "bge-reranker-v2-m3": "https://router.huggingface.co/hf-inference/models/BAAI/bge-reranker-v2-m3",
};

interface Document {
  id: string;
  content: string;
  score?: number;
}

function keywordRerank(query: string, documents: Document[], topK: number) {
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  return documents
    .map(doc => {
      const docWords = doc.content.toLowerCase().split(/\s+/);
      const overlap = docWords.filter(w => queryWords.has(w)).length;
      const score = overlap / Math.max(queryWords.size, 1);
      return { id: doc.id, content: doc.content, original_score: doc.score || 0, rerank_score: score };
    })
    .sort((a, b) => b.rerank_score - a.rerank_score)
    .slice(0, topK);
}

async function rerank(query: string, documents: Document[], model: string, topK: number): Promise<{ id: string; content: string; original_score: number; rerank_score: number; method: string }[]> {
  if (!HF_API_KEY || documents.length === 0) {
    return keywordRerank(query, documents, topK).map(r => ({ ...r, method: "keyword_overlap" }));
  }

  const endpoint = RERANKER_MODELS[model] || RERANKER_MODELS["qwen3-reranker-8b"];

  // Try ML reranker first
  try {
    const pairs = documents.map(doc => [query, doc.content]);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: pairs }),
    });

    if (!res.ok) {
      // Model unavailable - fall back to keyword overlap
      return keywordRerank(query, documents, topK).map(r => ({ ...r, method: "keyword_fallback" }));
    }

    const scores: number[] = await res.json();

    return documents
      .map((doc, i) => ({
        id: doc.id,
        content: doc.content,
        original_score: doc.score || 0,
        rerank_score: Array.isArray(scores) ? (typeof scores[i] === "number" ? scores[i] : (scores[i] as { score?: number })?.score || 0) : 0,
        method: "ml_reranker",
      }))
      .sort((a, b) => b.rerank_score - a.rerank_score)
      .slice(0, topK);
  } catch {
    // Network error - fall back to keyword overlap
    return keywordRerank(query, documents, topK).map(r => ({ ...r, method: "keyword_fallback" }));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ service: "rag-rerank-v2", version: VERSION, models: Object.keys(RERANKER_MODELS) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  try {
    const { query, documents, top_k = 5, model = "qwen3-reranker-8b" } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!documents || !Array.isArray(documents)) return new Response(JSON.stringify({ error: "documents array is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const results = await rerank(query, documents, model, top_k);

    return new Response(JSON.stringify({
      results,
      total_candidates: documents.length,
      returned: results.length,
      model,
      processing_time_ms: Date.now() - start,
      version: VERSION,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
