/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Semantic Search
 * ═══════════════════════════════════════════════════════════════
 * Hybrid semantic search over the Knowledge Base (chunks/documents).
 *
 * Strategy:
 *  1. Embed query via rag-embed-v2 (Qwen/HF/OpenAI)
 *  2. Vector match against chunks (pgvector)
 *  3. Fallback to ILIKE / pg_trgm fuzzy match if vector search empty
 *  4. In-memory TTL cache (5 min) keyed by query+kbId
 *
 * Returns top-K chunks with parent document title + source URL.
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SearchResult {
  chunk_id: string;
  document_id: string | null;
  document_title: string | null;
  source_url: string | null;
  content: string;
  similarity: number;
  matched_via: "vector" | "trigram" | "ilike";
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { ts: number; data: SearchResult[] }>();

function cacheKey(q: string, kb: string | null, k: number) {
  return `${kb ?? "*"}::${k}::${q.toLowerCase().trim()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const query = String(body?.query ?? "").trim();
    const knowledgeBaseId: string | null = body?.knowledge_base_id ?? null;
    const topK = Math.min(Math.max(Number(body?.top_k ?? 10), 1), 50);

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ error: "query must be at least 2 chars" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Cache lookup ─────────────────────────────────────────────
    const key = cacheKey(query, knowledgeBaseId, topK);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ results: cached.data, cached: true, total: cached.data.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let results: SearchResult[] = [];

    // ── 1. Try vector search via rag-embed-v2 + match_documents RPC ──
    try {
      const embedResp = await fetch(
        `${SUPABASE_URL}/functions/v1/rag-embed-v2`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
          },
          body: JSON.stringify({
            texts: [query],
            provider: "qwen3-embedding-8b",
            dimension: 1024,
            task: "retrieval.query",
          }),
        },
      );

      if (embedResp.ok) {
        const embedData = await embedResp.json();
        const queryEmbedding = embedData?.embeddings?.[0];

        if (Array.isArray(queryEmbedding)) {
          const { data: matches, error: matchErr } = await supabase.rpc(
            "match_documents",
            {
              query_embedding: queryEmbedding,
              match_threshold: 0.4,
              match_count: topK,
              p_knowledge_base_id: knowledgeBaseId,
            },
          );

          if (!matchErr && Array.isArray(matches)) {
            results = matches.map((m: Record<string, unknown>) => ({
              chunk_id: String(m.id),
              document_id: m.document_id ? String(m.document_id) : null,
              document_title: null,
              source_url: null,
              content: String(m.content ?? ""),
              similarity: Number(m.similarity ?? 0),
              matched_via: "vector",
            }));
          }
        }
      }
    } catch (e) {
      console.warn("vector search failed, falling back to text", e);
    }

    // ── 2. Fallback: ILIKE on chunks.content ─────────────────────
    if (results.length === 0) {
      const tokens = query.split(/\s+/).filter((t) => t.length > 2).slice(0, 5);
      const ilikePattern = `%${query.replace(/[%_]/g, "")}%`;

      let q = supabase
        .from("chunks")
        .select("id, document_id, content")
        .ilike("content", ilikePattern)
        .limit(topK);

      const { data: textMatches } = await q;
      if (textMatches?.length) {
        results = textMatches.map((m) => ({
          chunk_id: m.id,
          document_id: m.document_id,
          document_title: null,
          source_url: null,
          content: m.content,
          // Naive ranking: count token occurrences
          similarity:
            tokens.reduce(
              (acc, t) =>
                acc +
                (m.content.toLowerCase().split(t.toLowerCase()).length - 1),
              0,
            ) / Math.max(tokens.length, 1) / 10,
          matched_via: "ilike" as const,
        }));
        results.sort((a, b) => b.similarity - a.similarity);
      }
    }

    // ── 3. Hydrate document titles + source_url ──────────────────
    const docIds = [...new Set(results.map((r) => r.document_id).filter(Boolean))];
    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, title, source_url")
        .in("id", docIds as string[]);
      const docMap = new Map((docs ?? []).map((d) => [d.id, d]));
      results = results.map((r) => {
        const d = r.document_id ? docMap.get(r.document_id) : null;
        return {
          ...r,
          document_title: d?.title ?? null,
          source_url: d?.source_url ?? null,
        };
      });
    }

    cache.set(key, { ts: Date.now(), data: results });

    // Cleanup old cache entries (keep map small)
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (now - v.ts > CACHE_TTL_MS) cache.delete(k);
      }
    }

    return new Response(
      JSON.stringify({ results, cached: false, total: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("semantic-search error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
