// Knowledge Gap Analysis: detecta queries sem boas respostas e sugere artigos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { knowledge_base_id } = await req.json();
    if (!knowledge_base_id) return new Response(JSON.stringify({ error: "knowledge_base_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    // Pegar últimas 100 queries do oracle_history (proxy para queries dos usuários)
    const { data: history } = await supabase
      .from("oracle_history")
      .select("query, confidence_score")
      .order("created_at", { ascending: false })
      .limit(100);

    const lowConfidence = (history ?? []).filter((h: { confidence_score?: number }) => (h.confidence_score ?? 1) < 0.6);

    let inserted = 0;
    for (const h of lowConfidence) {
      const normalized = h.query.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 500);
      const { error } = await supabase.from("kb_query_gaps").upsert({
        knowledge_base_id,
        query: h.query.slice(0, 1000),
        query_normalized: normalized,
        best_match_score: h.confidence_score ?? 0,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "knowledge_base_id,query_normalized", ignoreDuplicates: false });
      if (!error) inserted++;
    }

    // Para cada gap aberto sem suggested_topic, gerar sugestão via AI
    const { data: openGaps } = await supabase
      .from("kb_query_gaps")
      .select("id, query")
      .eq("knowledge_base_id", knowledge_base_id)
      .eq("status", "open")
      .is("suggested_topic", null)
      .limit(10);

    if (lovableKey && openGaps && openGaps.length > 0) {
      for (const gap of openGaps) {
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Você sugere tópicos de artigos de FAQ. Responda APENAS em JSON: {\"topic\": \"...\", \"outline\": [\"seção 1\", \"seção 2\"]}" },
                { role: "user", content: `Pergunta sem boa resposta: ${gap.query}\n\nSugira título de artigo e estrutura.` },
              ],
            }),
          });
          if (r.ok) {
            const j = await r.json();
            const txt = j.choices?.[0]?.message?.content ?? "{}";
            const cleaned = txt.replace(/```json\n?/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleaned);
            await supabase.from("kb_query_gaps").update({
              suggested_topic: parsed.topic ?? null,
              suggested_outline: parsed.outline ?? null,
            }).eq("id", gap.id);
          }
        } catch (e) {
          console.error("Suggestion failed for gap", gap.id, e);
        }
      }
    }

    return new Response(JSON.stringify({ analyzed: lowConfidence.length, gaps_recorded: inserted, suggestions_generated: openGaps?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
