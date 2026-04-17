import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { audio_base64, mime_type = "audio/webm", session_id } = body || {};
    if (!audio_base64 || typeof audio_base64 !== "string") {
      return new Response(JSON.stringify({ error: "audio_base64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (audio_base64.length > 14_000_000) {
      return new Response(JSON.stringify({ error: "audio too large (max ~10MB)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a transcription engine. Return ONLY the verbatim spoken text in the original language. No commentary, no formatting, no quotes." },
          { role: "user", content: [
            { type: "text", text: "Transcreva o áudio a seguir literalmente:" },
            { type: "image_url", image_url: { url: `data:${mime_type};base64,${audio_base64}` } },
          ] },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Transcription failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await aiResp.json();
    const text = (json?.choices?.[0]?.message?.content || "").trim();

    // Estimar duração (rough): tamanho base64 / ~16kbps webm
    const approxBytes = (audio_base64.length * 3) / 4;
    const approxSeconds = Math.max(0.5, approxBytes / 2000);

    if (session_id) {
      const { data: session } = await supabase.from("voice_sessions").select("transcript, audio_in_seconds").eq("id", session_id).maybeSingle();
      if (session) {
        const newTranscript = [...(session.transcript as any[] || []), { role: "user", text, ts: new Date().toISOString() }];
        await supabase.from("voice_sessions").update({
          transcript: newTranscript,
          audio_in_seconds: Number(session.audio_in_seconds || 0) + approxSeconds,
        }).eq("id", session_id);
      }
    }

    return new Response(JSON.stringify({ text, duration_seconds: approxSeconds }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("voice-transcribe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
