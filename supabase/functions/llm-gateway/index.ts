import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══ Rate Limiting ═══
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 30; // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

// ═══ Input Validation ═══
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
  
  const temperature = typeof b.temperature === 'number' ? Math.max(0, Math.min(2, b.temperature)) : 0.7;
  const max_tokens = typeof b.max_tokens === 'number' ? Math.max(1, Math.min(32000, Math.floor(b.max_tokens))) : 4000;
  
  return {
    valid: true,
    data: {
      model: b.model as string,
      messages: b.messages as Array<{ role: string; content: string }>,
      temperature,
      max_tokens,
      workspace_id: typeof b.workspace_id === 'string' ? b.workspace_id : undefined,
    },
  };
}

interface LLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
  workspace_id?: string;
}

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

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 30 requests per minute.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
    }

    // Validate input
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { 
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const validation = validateRequest(rawBody);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { model, messages, temperature, max_tokens } = validation.data;

    // Get workspace
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const workspaceId = member?.workspace_id || validation.data.workspace_id;

    // Try to get API key - first OpenRouter, then provider-specific
    let apiKey = '';
    let provider = 'openrouter';

    if (workspaceId) {
      // Try OpenRouter first
      const { data: orKey } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', 'openrouter_api_key').single();
      if (orKey?.key_value) {
        apiKey = orKey.key_value;
        provider = 'openrouter';
      } else if (model.includes('claude') || model.includes('anthropic')) {
        const { data: k } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', 'anthropic_api_key').single();
        if (k?.key_value) { apiKey = k.key_value; provider = 'anthropic'; }
      } else if (model.includes('gpt') || model.includes('openai')) {
        const { data: k } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', 'openai_api_key').single();
        if (k?.key_value) { apiKey = k.key_value; provider = 'openai'; }
      } else if (model.includes('gemini') || model.includes('google')) {
        const { data: k } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', 'google_ai_api_key').single();
        if (k?.key_value) { apiKey = k.key_value; provider = 'google'; }
      }
    }

    // Try Lovable AI as fallback
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey && lovableApiKey) {
      provider = 'lovable';
      apiKey = lovableApiKey;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key configured. Add an API key in Settings.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();
    let result: any;

    if (provider === 'lovable') {
      const lovableModel = mapToLovableModel(model);
      const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: lovableModel, messages, temperature, max_tokens }),
      });
      result = await response.json();
    } else if (provider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': supabaseUrl,
          'X-Title': 'Fator X',
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens }),
      });
      result = await response.json();
    } else if (provider === 'anthropic') {
      const systemMsg = messages.find(m => m.role === 'system');
      const nonSystemMsgs = messages.filter(m => m.role !== 'system');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model.replace('anthropic/', ''),
          system: systemMsg?.content || '',
          messages: nonSystemMsgs,
          temperature,
          max_tokens,
        }),
      });
      const anthropicResult = await response.json();
      result = {
        choices: [{ message: { content: anthropicResult.content?.[0]?.text || '' } }],
        usage: {
          prompt_tokens: anthropicResult.usage?.input_tokens || 0,
          completion_tokens: anthropicResult.usage?.output_tokens || 0,
          total_tokens: (anthropicResult.usage?.input_tokens || 0) + (anthropicResult.usage?.output_tokens || 0),
        },
      };
    } else {
      const url = provider === 'google'
        ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model.replace('openai/', '').replace('google/', ''), messages, temperature, max_tokens }),
      });
      result = await response.json();
    }

    const latencyMs = Date.now() - startTime;
    const content = result.choices?.[0]?.message?.content || result.error?.message || '';
    const usage = result.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;
    const costUsd = totalTokens * 0.000003;

    return new Response(JSON.stringify({
      content,
      model,
      provider,
      tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
      cost_usd: Math.round(costUsd * 1000000) / 1000000,
      latency_ms: latencyMs,
      finish_reason: result.choices?.[0]?.finish_reason || 'stop',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapToLovableModel(model: string): string {
  if (model.includes('gemini-2.5-flash')) return 'google/gemini-2.5-flash';
  if (model.includes('gemini-2.5-pro')) return 'google/gemini-2.5-pro';
  if (model.includes('gemini-3')) return 'google/gemini-3-flash-preview';
  if (model.includes('gpt-5')) return 'openai/gpt-5';
  if (model.includes('gpt-4o')) return 'openai/gpt-5-mini';
  return 'google/gemini-2.5-flash';
}
