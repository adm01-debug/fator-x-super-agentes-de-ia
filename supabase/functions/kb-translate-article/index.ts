// Tradução com cache (translation memory) via Lovable AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { article_id, target_language } = await req.json();
    if (!article_id || !target_language) return new Response(JSON.stringify({ error: "article_id and target_language required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");

    const { data: article } = await supabase.from("kb_articles").select("*").eq("id", article_id).maybeSingle();
    if (!article) return new Response(JSON.stringify({ error: "Article not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sourceText = JSON.stringify({ title: article.title, content: article.content_json });
    const hash = await sha256(sourceText);

    // Translation memory cache check
    const { data: cached } = await supabase.from("kb_translations")
      .select("*")
      .eq("article_id", article_id)
      .eq("target_language", target_language)
      .eq("source_hash", hash)
      .maybeSingle();
    if (cached) {
      return new Response(JSON.stringify({ cached: true, translation: cached }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Você é tradutor profissional. Traduza para ${target_language} mantendo a estrutura JSON do TipTap. Responda APENAS com JSON: {"title": "...", "content": <tiptap json>}` },
          { role: "user", content: `Traduzir de ${article.language} para ${target_language}:\n\n${sourceText}` },
        ],
      }),
    });
    if (!r.ok) throw new Error(`AI gateway error: ${r.status}`);
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const { data: inserted, error } = await supabase.from("kb_translations").insert({
      article_id,
      source_language: article.language,
      target_language,
      source_hash: hash,
      translated_title: parsed.title ?? article.title,
      translated_content_json: parsed.content ?? {},
      translation_method: "ai",
    }).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ cached: false, translation: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
