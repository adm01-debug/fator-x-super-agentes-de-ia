import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
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

    const body: LLMRequest = await req.json();
    const { model, messages, temperature = 0.7, max_tokens = 4000 } = body;

    if (!model || !messages?.length) {
      return new Response(JSON.stringify({ error: 'model and messages required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get workspace
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const workspaceId = member?.workspace_id || body.workspace_id;

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
      // Use Lovable AI
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
          'X-Title': 'Nexus Agents Studio',
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
      // OpenAI / Google (OpenAI-compatible)
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

    // Estimate cost (rough)
    const costUsd = totalTokens * 0.000003; // ~$3/M tokens average

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
