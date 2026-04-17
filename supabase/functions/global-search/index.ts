/**
 * Nexus — Global Search (Semantic Hybrid)
 *
 * Estratégia híbrida em 2 estágios:
 *  1) Recall: ILIKE + fuzzy em múltiplas tabelas (rápido, escopado por RLS).
 *  2) Re-rank: Lovable AI Gateway pontua semanticamente cada candidato vs query.
 *     Score final = 0.4 * lexical + 0.6 * semantic.
 *
 * Se o LLM falhar ou estiver indisponível, retorna ranking lexical puro (graceful).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchHit {
  type: "agent" | "knowledge_base" | "article" | "workflow" | "eval_dataset" | "automation" | "document";
  id: string;
  title: string;
  snippet: string;
  url: string;
  score: number;
  lexical_score?: number;
  semantic_score?: number;
  meta?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const query = String(body?.query ?? "").trim();
    const limit = Math.min(Math.max(Number(body?.limit ?? 8), 1), 20);
    const semanticEnabled = body?.semantic !== false; // default true

    if (query.length < 2) {
      return new Response(JSON.stringify({ results: [], total: 0, mode: "empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanQuery = query.replace(/[%_]/g, "");
    const pattern = `%${cleanQuery}%`;
    const ql = query.toLowerCase();

    const lexicalScore = (text: string | null | undefined) => {
      if (!text) return 0;
      const t = text.toLowerCase();
      if (t === ql) return 1;
      if (t.startsWith(ql)) return 0.85;
      const words = ql.split(/\s+/).filter(w => w.length > 1);
      const matches = words.filter(w => t.includes(w)).length;
      if (matches === words.length && words.length > 0) return 0.7;
      if (matches > 0) return 0.4 + (matches / words.length) * 0.25;
      if (t.includes(ql)) return 0.6;
      return 0.3;
    };

    // STAGE 1 — Recall: ILIKE em paralelo, escopado por RLS
    const recallLimit = Math.max(limit, 6);
    const [agentsR, kbR, articlesR, workflowsR, evalsR, autoR, docsR] = await Promise.all([
      supabase.from("agents").select("id, name, mission, persona, model")
        .or(`name.ilike.${pattern},mission.ilike.${pattern},persona.ilike.${pattern}`).limit(recallLimit),
      supabase.from("knowledge_bases").select("id, name, description")
        .or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(recallLimit),
      supabase.from("kb_articles").select("id, title, excerpt, slug, knowledge_base_id, status")
        .or(`title.ilike.${pattern},excerpt.ilike.${pattern}`).eq("status", "published").limit(recallLimit),
      supabase.from("agent_workflows").select("id, name, description, status")
        .or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(recallLimit),
      supabase.from("agent_eval_datasets").select("id, name, description")
        .or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(recallLimit),
      supabase.from("automation_rules").select("id, name, description, is_active")
        .or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(recallLimit),
      supabase.from("documents").select("id, title, source_url").ilike("title", pattern).limit(recallLimit),
    ]);

    const candidates: SearchHit[] = [];

    (agentsR.data ?? []).forEach((a: any) => candidates.push({
      type: "agent", id: a.id, title: a.name,
      snippet: a.mission || a.persona || a.model || "Agente",
      url: `/builder/${a.id}`,
      score: 0, lexical_score: lexicalScore(`${a.name} ${a.mission ?? ""}`) + 0.05,
      meta: { model: a.model },
    }));

    (kbR.data ?? []).forEach((k: any) => candidates.push({
      type: "knowledge_base", id: k.id, title: k.name,
      snippet: k.description || "Base de conhecimento",
      url: `/knowledge`,
      score: 0, lexical_score: lexicalScore(`${k.name} ${k.description ?? ""}`),
    }));

    (articlesR.data ?? []).forEach((a: any) => candidates.push({
      type: "article", id: a.id, title: a.title,
      snippet: a.excerpt || "Artigo da KB",
      url: `/knowledge`,
      score: 0, lexical_score: lexicalScore(`${a.title} ${a.excerpt ?? ""}`),
    }));

    (workflowsR.data ?? []).forEach((w: any) => candidates.push({
      type: "workflow", id: w.id, title: w.name,
      snippet: w.description || `Status: ${w.status}`,
      url: `/workflows`,
      score: 0, lexical_score: lexicalScore(`${w.name} ${w.description ?? ""}`),
      meta: { status: w.status },
    }));

    (evalsR.data ?? []).forEach((e: any) => candidates.push({
      type: "eval_dataset", id: e.id, title: e.name,
      snippet: e.description || "Dataset de avaliação",
      url: `/evaluations`,
      score: 0, lexical_score: lexicalScore(`${e.name} ${e.description ?? ""}`),
    }));

    (autoR.data ?? []).forEach((r: any) => candidates.push({
      type: "automation", id: r.id, title: r.name,
      snippet: r.description || (r.is_active ? "Ativa" : "Inativa"),
      url: `/automations`,
      score: 0, lexical_score: lexicalScore(`${r.name} ${r.description ?? ""}`),
      meta: { active: r.is_active },
    }));

    (docsR.data ?? []).forEach((d: any) => candidates.push({
      type: "document", id: d.id, title: d.title,
      snippet: d.source_url || "Documento",
      url: `/knowledge`,
      score: 0, lexical_score: (lexicalScore(d.title) - 0.05),
    }));

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ results: [], total: 0, mode: "no-recall" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit candidates sent to LLM for cost/latency control
    candidates.sort((a, b) => (b.lexical_score ?? 0) - (a.lexical_score ?? 0));
    const topCandidates = candidates.slice(0, Math.min(20, candidates.length));

    // STAGE 2 — Semantic re-rank via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let mode: string = "lexical";

    if (semanticEnabled && LOVABLE_API_KEY && topCandidates.length > 1) {
      try {
        const candidateList = topCandidates.map((c, i) =>
          `${i}|${c.type}|${c.title}|${(c.snippet || "").slice(0, 120)}`
        ).join("\n");

        const llmResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: "You score candidate items by semantic relevance to a user query (0.0-1.0). Reply only with the tool call. Consider intent, synonyms, related concepts.",
              },
              {
                role: "user",
                content: `Query: "${query}"\n\nCandidates (index|type|title|snippet):\n${candidateList}\n\nScore each candidate 0.0-1.0 by semantic relevance to the query.`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "score_candidates",
                description: "Returns semantic relevance scores for each candidate.",
                parameters: {
                  type: "object",
                  properties: {
                    scores: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "number" },
                          score: { type: "number", minimum: 0, maximum: 1 },
                        },
                        required: ["index", "score"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["scores"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "score_candidates" } },
          }),
        });

        if (llmResp.ok) {
          const llmJson = await llmResp.json();
          const toolCall = llmJson?.choices?.[0]?.message?.tool_calls?.[0];
          const args = toolCall?.function?.arguments;
          if (args) {
            const parsed = JSON.parse(args);
            const scores: { index: number; score: number }[] = parsed?.scores ?? [];
            for (const s of scores) {
              if (topCandidates[s.index]) {
                topCandidates[s.index].semantic_score = Math.max(0, Math.min(1, s.score));
              }
            }
            mode = "semantic-hybrid";
          }
        } else if (llmResp.status === 429 || llmResp.status === 402) {
          console.warn(`Semantic re-rank skipped: ${llmResp.status}`);
          mode = "lexical-fallback-rate";
        } else {
          console.warn("Semantic re-rank failed:", llmResp.status);
        }
      } catch (e) {
        console.warn("Semantic re-rank error:", e instanceof Error ? e.message : e);
      }
    }

    // Final blended score
    for (const c of topCandidates) {
      const lex = c.lexical_score ?? 0;
      const sem = c.semantic_score;
      c.score = sem != null ? (0.4 * lex + 0.6 * sem) : lex;
    }
    topCandidates.sort((a, b) => b.score - a.score);

    const final = topCandidates.slice(0, limit);

    return new Response(JSON.stringify({ results: final, total: final.length, mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("global-search error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
