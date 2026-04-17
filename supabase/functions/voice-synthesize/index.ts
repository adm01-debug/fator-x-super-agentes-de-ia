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
    const { user_text, session_id, agent_id } = body || {};
    if (!user_text || typeof user_text !== "string" || user_text.length > 2048) {
      return new Response(JSON.stringify({ error: "user_text required (≤2KB)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let agentPersona = "Você é um assistente conversacional natural e cordial, falando em português do Brasil.";
    let history: any[] = [];
    if (agent_id) {
      const { data: agent } = await supabase.from("agents").select("persona, mission").eq("id", agent_id).maybeSingle();
      if (agent) agentPersona = `${agent.persona || ""}\n\nMissão: ${agent.mission || ""}\n\nResponda de forma curta e conversacional para áudio (≤2 frases, ~30s falados).`;
    }
    if (session_id) {
      const { data: session } = await supabase.from("voice_sessions").select("transcript").eq("id", session_id).maybeSingle();
      if (session) {
        history = ((session.transcript as any[]) || []).slice(-10).map((t: any) => ({ role: t.role === "user" ? "user" : "assistant", content: t.text }));
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: agentPersona },
          ...history,
          { role: "user", content: user_text },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Synthesis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await aiResp.json();
    const reply = (json?.choices?.[0]?.message?.content || "").trim();
    const tokens = json?.usage?.total_tokens || 0;
    const costCents = Math.ceil(tokens * 0.0003); // ~$0.30/1M tokens flash

    if (session_id) {
      const { data: session } = await supabase.from("voice_sessions").select("transcript, cost_cents, audio_out_seconds").eq("id", session_id).maybeSingle();
      if (session) {
        const newTranscript = [...((session.transcript as any[]) || []), { role: "assistant", text: reply, ts: new Date().toISOString() }];
        const approxSpeechSec = Math.max(1, reply.split(/\s+/).length / 2.5); // ~150 wpm
        await supabase.from("voice_sessions").update({
          transcript: newTranscript,
          cost_cents: (session.cost_cents || 0) + costCents,
          audio_out_seconds: Number(session.audio_out_seconds || 0) + approxSpeechSec,
        }).eq("id", session_id);
      }
    }

    return new Response(JSON.stringify({ reply, cost_cents: costCents }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("voice-synthesize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
