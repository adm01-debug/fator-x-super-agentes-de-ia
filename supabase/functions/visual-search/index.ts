/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Visual Search
 * ═══════════════════════════════════════════════════════════════
 * Image-based semantic search over the Knowledge Base.
 *
 * Pipeline:
 *  1. Receive base64 image (data URL or raw b64) + optional hint
 *  2. Use Lovable AI Gateway (google/gemini-2.5-flash, multimodal)
 *     to extract a rich textual description of the image
 *  3. Forward the description to /semantic-search to retrieve
 *     matching chunks/documents from the knowledge base
 *
 * Returns: { description, results[] }
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VISION_PROMPT = `Você é um sistema de busca visual. Analise a imagem e produza uma descrição
densa e rica em palavras-chave (em português) que sirva como query de busca semântica
em uma base de conhecimento. Foque em:
- Objetos, produtos e materiais visíveis
- Cores, formas, marcas e textos legíveis
- Categoria/tipo provável
- Atributos distintivos (modelo, padrão, função)

Retorne APENAS a descrição (1-3 frases), sem prefixos.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const imageRaw = String(body?.image ?? "").trim();
    const hint = String(body?.hint ?? "").trim();
    const knowledgeBaseId = body?.knowledge_base_id ?? null;
    const topK = Math.min(Math.max(Number(body?.top_k ?? 10), 1), 50);

    if (!imageRaw) {
      return new Response(JSON.stringify({ error: "image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize image to data URL
    const imageDataUrl = imageRaw.startsWith("data:")
      ? imageRaw
      : `data:image/jpeg;base64,${imageRaw}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Vision extraction ─────────────────────────────────────
    const visionResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: hint
                    ? `${VISION_PROMPT}\n\nDica do usuário: ${hint}`
                    : VISION_PROMPT,
                },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 200,
        }),
      },
    );

    if (visionResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Tente em alguns instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (visionResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!visionResp.ok) {
      const t = await visionResp.text();
      console.error("Vision API error", visionResp.status, t);
      return new Response(
        JSON.stringify({ error: "Falha ao analisar a imagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const visionData = await visionResp.json();
    const description = String(
      visionData?.choices?.[0]?.message?.content ?? "",
    ).trim();

    if (!description) {
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar descrição da imagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Forward to semantic-search ────────────────────────────
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const searchResp = await fetch(
      `${SUPABASE_URL}/functions/v1/semantic-search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
        body: JSON.stringify({
          query: description,
          knowledge_base_id: knowledgeBaseId,
          top_k: topK,
        }),
      },
    );

    const searchData = await searchResp.json();

    return new Response(
      JSON.stringify({
        description,
        results: searchData?.results ?? [],
        total: searchData?.total ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("visual-search error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
