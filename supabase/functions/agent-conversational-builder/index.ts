// Agent Conversational Builder — chat-to-agent via Lovable AI
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SYSTEM_PROMPT = `Você é um assistente especializado em ajudar usuários a configurar agentes de IA na plataforma Fator X.

Seu objetivo: através de uma conversa amigável em português, descobrir o que o usuário quer e auto-preencher os campos do agente.

CAMPOS DISPONÍVEIS:
- name (string): nome curto do agente
- avatar_emoji (string): 1 emoji representativo
- mission (string): missão clara em 1-2 frases
- persona (string): tom/personalidade (ex: "amigável e técnico")
- model (string): "google/gemini-2.5-flash" | "google/gemini-2.5-pro" | "openai/gpt-5" | "openai/gpt-5-mini"
- system_prompt (string): prompt completo de sistema
- reasoning (string): "low" | "medium" | "high"

REGRAS:
1. Faça UMA pergunta clara por vez (nunca várias).
2. Comece sempre perguntando o objetivo geral do agente.
3. Quando entender o suficiente, sugira valores e PREENCHA via tool call "patch_agent".
4. Após cada patch, faça a próxima pergunta OU declare done=true se estiver completo.
5. Sempre use a ferramenta "patch_agent" para aplicar mudanças — nunca peça pro usuário copiar JSON.
6. Seja conciso: respostas de 1-3 frases.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { messages, currentAgent } = await req.json();

    const contextMsg = currentAgent
      ? `\n\nESTADO ATUAL DO AGENTE:\n${JSON.stringify(currentAgent, null, 2)}`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextMsg },
          ...messages,
        ],
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "patch_agent",
              description: "Aplica mudanças aos campos do agente em construção.",
              parameters: {
                type: "object",
                properties: {
                  patch: {
                    type: "object",
                    description: "Campos a atualizar no agente.",
                    properties: {
                      name: { type: "string" },
                      avatar_emoji: { type: "string" },
                      mission: { type: "string" },
                      persona: { type: "string" },
                      model: { type: "string" },
                      system_prompt: { type: "string" },
                      reasoning: { type: "string", enum: ["low", "medium", "high"] },
                    },
                  },
                  done: { type: "boolean", description: "true se o agente está pronto." },
                },
                required: ["patch"],
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errMsg = status === 429
        ? "Limite de requisições atingido. Tente novamente em instantes."
        : status === 402
        ? "Créditos esgotados. Adicione créditos no workspace."
        : `Gateway error ${status}`;
      return new Response(JSON.stringify({ error: errMsg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("conversational-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
