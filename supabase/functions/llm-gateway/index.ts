import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callLovable, callOpenRouter, callAnthropic, callOpenAICompatible, type LLMCallParams } from "./providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══ Rate Limiting ═══
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

// ═══ Input Validation ═══
interface LLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
  workspace_id?: string;
}

function validateRequest(body: unknown): { valid: true; data: LLMRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object' };
  const b = body as Record<string, unknown>;

  if (typeof b.model !== 'string' || b.model.length < 2 || b.model.length > 200) {
    return { valid: false, error: 'model must be a string (2-200 chars)' };
  }
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > 100) {
    return { valid: false, error: 'messages must be a non-empty array (max 100)' };
  }
  for (const msg of b.messages) {
    if (!msg || typeof msg !== 'object') return { valid: false, error: 'Each message must be an object' };
    const m = msg as Record<string, unknown>;
    if (typeof m.role !== 'string' || !['system', 'user', 'assistant'].includes(m.role)) {
      return { valid: false, error: 'Each message.role must be "system", "user", or "assistant"' };
    }
    if (typeof m.content !== 'string' || m.content.length === 0) {
      return { valid: false, error: 'Each message.content must be a non-empty string' };
    }
  }

  return {
    valid: true,
    data: {
      model: b.model as string,
      messages: b.messages as Array<{ role: string; content: string }>,
      temperature: typeof b.temperature === 'number' ? Math.max(0, Math.min(2, b.temperature)) : 0.7,
      max_tokens: typeof b.max_tokens === 'number' ? Math.max(1, Math.min(32000, Math.floor(b.max_tokens))) : 4000,
      workspace_id: typeof b.workspace_id === 'string' ? b.workspace_id : undefined,
    },
  };
}

// ═══ API Key Resolution ═══
async function resolveApiKey(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string | undefined,
  model: string,
): Promise<{ apiKey: string; provider: string }> {
  if (workspaceId) {
    const { data: orKey } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', 'openrouter_api_key').single();
    if (orKey?.key_value) return { apiKey: orKey.key_value, provider: 'openrouter' };

    const providerMap: Array<{ match: string; keyName: string; provider: string }> = [
      { match: 'claude', keyName: 'anthropic_api_key', provider: 'anthropic' },
      { match: 'gpt', keyName: 'openai_api_key', provider: 'openai' },
      { match: 'gemini', keyName: 'google_ai_api_key', provider: 'google' },
    ];

    for (const pm of providerMap) {
      if (model.includes(pm.match)) {
        const { data: k } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', pm.keyName).single();
        if (k?.key_value) return { apiKey: k.key_value, provider: pm.provider };
      }
    }
  }

  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (lovableApiKey) return { apiKey: lovableApiKey, provider: 'lovable' };

  return { apiKey: '', provider: '' };
}

// ═══ Main Handler ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 30 requests per minute.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
    }

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validation = validateRequest(rawBody);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { model, messages, temperature, max_tokens } = validation.data;

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const workspaceId = member?.workspace_id || validation.data.workspace_id;

    const { apiKey, provider } = await resolveApiKey(supabase, workspaceId ?? undefined, model);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key configured. Add an API key in Settings.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();
    const callParams: LLMCallParams = { model, messages, temperature, max_tokens };

    const result = provider === 'lovable' ? await callLovable(callParams, apiKey)
      : provider === 'openrouter' ? await callOpenRouter(callParams, apiKey, supabaseUrl)
      : provider === 'anthropic' ? await callAnthropic(callParams, apiKey)
      : await callOpenAICompatible(callParams, apiKey, provider);

    const latencyMs = Date.now() - startTime;
    const costUsd = result.usage.total_tokens * 0.000003;

    return new Response(JSON.stringify({
      content: result.content,
      model,
      provider,
      tokens: { prompt: result.usage.prompt_tokens, completion: result.usage.completion_tokens, total: result.usage.total_tokens },
      cost_usd: Math.round(costUsd * 1000000) / 1000000,
      latency_ms: latencyMs,
      finish_reason: result.finish_reason,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
