// Quick Agent Test — runs a single LLM call against Lovable AI Gateway
// for the wizard's "test before save" feature.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Map the wizard's friendly model id to a model supported by Lovable AI Gateway. */
function mapModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes('gpt-4o') || m.includes('gpt-4-turbo')) return 'openai/gpt-5-mini';
  if (m.includes('claude-3-opus')) return 'google/gemini-2.5-pro';
  if (m.includes('claude-3.5-sonnet') || m.includes('claude')) return 'google/gemini-2.5-pro';
  if (m.includes('gemini-1.5-pro') || m.includes('gemini-2.5-pro')) return 'google/gemini-2.5-pro';
  if (m.includes('gemini')) return 'google/gemini-2.5-flash';
  if (m.includes('llama')) return 'google/gemini-2.5-flash-lite';
  return 'google/gemini-3-flash-preview';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'LOVABLE_API_KEY não configurada' }, 500);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'Body inválido' }, 400);
    }

    const systemPrompt = String((body as Record<string, unknown>).system_prompt ?? '').trim();
    const userMessage = String((body as Record<string, unknown>).user_message ?? '').trim();
    const model = String((body as Record<string, unknown>).model ?? 'gpt-4o');

    if (systemPrompt.length < 10) {
      return jsonResponse({ error: 'system_prompt muito curto (min 10 chars)' }, 400);
    }
    if (userMessage.length === 0 || userMessage.length > 4000) {
      return jsonResponse({ error: 'user_message vazio ou muito longo (max 4000)' }, 400);
    }

    const mapped = mapModel(model);
    const startedAt = Date.now();

    const upstream = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: mapped,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 800,
      }),
    });

    const latencyMs = Date.now() - startedAt;

    if (upstream.status === 429) {
      return jsonResponse(
        { error: 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.' },
        429,
      );
    }
    if (upstream.status === 402) {
      return jsonResponse(
        { error: 'Sem créditos disponíveis. Adicione créditos em Configurações > Workspace > Uso.' },
        402,
      );
    }
    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('AI gateway error', upstream.status, text);
      return jsonResponse({ error: `Erro do gateway (${upstream.status})` }, 502);
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const usage = data?.usage ?? {};

    return jsonResponse({
      response: typeof content === 'string' ? content : JSON.stringify(content),
      latency_ms: latencyMs,
      input_tokens: Number(usage.prompt_tokens ?? 0),
      output_tokens: Number(usage.completion_tokens ?? 0),
      total_tokens: Number(usage.total_tokens ?? 0),
      model_used: mapped,
      requested_model: model,
    });
  } catch (e) {
    console.error('quick-agent-test error', e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Erro inesperado' },
      500,
    );
  }
});
