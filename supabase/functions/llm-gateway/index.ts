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
  agent_id?: string;
  session_id?: string;
}

function validateRequest(body: unknown): { valid: true; data: LLMRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Request body must be a JSON object' };
  const b = body as Record<string, unknown>;
  if (typeof b.model !== 'string' || b.model.length < 2 || b.model.length > 200) return { valid: false, error: 'model must be a string (2-200 chars)' };
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > 100) return { valid: false, error: 'messages must be a non-empty array (max 100)' };
  for (const msg of b.messages) {
    if (!msg || typeof msg !== 'object') return { valid: false, error: 'Each message must be an object' };
    const m = msg as Record<string, unknown>;
    if (typeof m.role !== 'string' || !['system', 'user', 'assistant'].includes(m.role)) return { valid: false, error: 'Invalid message.role' };
    if (typeof m.content !== 'string' || m.content.length === 0) return { valid: false, error: 'Empty message.content' };
  }
  return {
    valid: true,
    data: {
      model: b.model as string,
      messages: b.messages as Array<{ role: string; content: string }>,
      temperature: typeof b.temperature === 'number' ? Math.max(0, Math.min(2, b.temperature)) : 0.7,
      max_tokens: typeof b.max_tokens === 'number' ? Math.max(1, Math.min(32000, Math.floor(b.max_tokens))) : 4000,
      workspace_id: typeof b.workspace_id === 'string' ? b.workspace_id : undefined,
      agent_id: typeof b.agent_id === 'string' ? b.agent_id : undefined,
      session_id: typeof b.session_id === 'string' ? b.session_id : undefined,
    },
  };
}

// ═══ Cost Calculation from DB pricing ═══
async function calculateCost(supabase: any, model: string, promptTokens: number, completionTokens: number): Promise<number> {
  try {
    const { data: pricing } = await supabase.from('model_pricing').select('model_pattern, input_cost_per_1k, output_cost_per_1k');
    if (pricing) {
      for (const p of pricing) {
        if (model.includes(p.model_pattern)) {
          return (promptTokens / 1000 * Number(p.input_cost_per_1k)) + (completionTokens / 1000 * Number(p.output_cost_per_1k));
        }
      }
    }
  } catch { /* fallback */ }
  return (promptTokens + completionTokens) * 0.000003;
}

// ═══ Guardrails Check ═══
async function checkGuardrails(supabase: any, agentId: string | undefined, userMessage: string): Promise<{ passed: boolean; triggered: Array<{ name: string; severity: string; reason: string }> }> {
  if (!agentId) return { passed: true, triggered: [] };
  try {
    const { data: agent } = await supabase.from('agents').select('config').eq('id', agentId).single();
    if (!agent?.config) return { passed: true, triggered: [] };
    const config = agent.config as Record<string, any>;
    const guardrails = (config.guardrails || []) as Array<{ enabled: boolean; name: string; category: string; severity: string; config?: any }>;
    const blockedTopics = (config.blocked_topics || []) as string[];
    const inputMaxLength = config.input_max_length || 10000;
    const triggered: Array<{ name: string; severity: string; reason: string }> = [];
    const lowerMsg = userMessage.toLowerCase();

    if (userMessage.length > inputMaxLength) triggered.push({ name: 'Input Max Length', severity: 'block', reason: `Exceeds ${inputMaxLength} chars` });
    for (const topic of blockedTopics) {
      if (topic && lowerMsg.includes(topic.toLowerCase())) triggered.push({ name: 'Blocked Topic', severity: 'block', reason: `Contains: "${topic}"` });
    }
    for (const gr of guardrails) {
      if (!gr.enabled) continue;
      if (gr.category === 'input_validation' && gr.config?.keywords) {
        for (const kw of gr.config.keywords as string[]) {
          if (kw && lowerMsg.includes(kw.toLowerCase())) triggered.push({ name: gr.name, severity: gr.severity, reason: `Keyword: "${kw}"` });
        }
      }
    }
    return { passed: !triggered.some(t => t.severity === 'block'), triggered };
  } catch { return { passed: true, triggered: [] }; }
}

// ═══ Budget Check ═══
async function checkBudget(supabase: any, workspaceId: string | undefined, agentId: string | undefined): Promise<{ allowed: boolean; reason?: string }> {
  if (!workspaceId) return { allowed: true };
  try {
    const { data: budgets } = await supabase.from('budgets').select('*').eq('workspace_id', workspaceId).eq('is_active', true);
    if (budgets) {
      for (const b of budgets) {
        if (Number(b.current_usd) >= Number(b.limit_usd)) {
          if (agentId) {
            const { data: agent } = await supabase.from('agents').select('config').eq('id', agentId).single();
            if ((agent?.config as any)?.budget_kill_switch) {
              return { allowed: false, reason: `Budget "${b.name}" exceeded: $${Number(b.current_usd).toFixed(4)} / $${b.limit_usd}` };
            }
          }
        }
      }
    }
  } catch { /* allow on error */ }
  return { allowed: true };
}

// ═══ Record Trace + Usage (non-blocking) ═══
async function recordTrace(supabase: any, p: {
  workspaceId?: string; agentId?: string; sessionId?: string;
  userInput: string; assistantOutput: string; model: string; provider: string;
  promptTokens: number; completionTokens: number; totalTokens: number;
  costUsd: number; latencyMs: number; guardrailsTriggered: any[];
  event: string; level: string;
}) {
  try {
    await supabase.from('agent_traces').insert({
      workspace_id: p.workspaceId, agent_id: p.agentId, session_id: p.sessionId,
      event: p.event, level: p.level, latency_ms: p.latencyMs, tokens_used: p.totalTokens,
      cost_usd: p.costUsd, user_input: p.userInput, assistant_output: p.assistantOutput?.substring(0, 5000),
      model: p.model, provider: p.provider, guardrails_triggered: p.guardrailsTriggered,
      metadata: { prompt_tokens: p.promptTokens, completion_tokens: p.completionTokens },
    });
    if (p.workspaceId) {
      await supabase.from('usage_records').insert({
        workspace_id: p.workspaceId, agent_id: p.agentId, record_type: 'llm_call',
        tokens: p.totalTokens, cost_usd: p.costUsd,
        metadata: { model: p.model, provider: p.provider, latency_ms: p.latencyMs },
      });
      // Daily aggregate
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase.from('agent_usage').select('id, total_tokens, total_cost, request_count').eq('workspace_id', p.workspaceId).eq('date', today).maybeSingle();
      if (existing) {
        await supabase.from('agent_usage').update({ total_tokens: (existing.total_tokens||0)+p.totalTokens, total_cost: (existing.total_cost||0)+p.costUsd, request_count: (existing.request_count||0)+1 }).eq('id', existing.id);
      } else {
        await supabase.from('agent_usage').insert({ workspace_id: p.workspaceId, date: today, total_tokens: p.totalTokens, total_cost: p.costUsd, request_count: 1 }).catch(()=>{});
      }
    }
  } catch (e) { console.error('Trace failed:', e); }
}

// ═══ API Key Resolution ═══
async function resolveApiKey(supabase: any, workspaceId: string | undefined, model: string): Promise<{ apiKey: string; provider: string }> {
  if (workspaceId) {
    const { data: orKey } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', 'openrouter_api_key').single();
    if (orKey?.key_value) return { apiKey: orKey.key_value, provider: 'openrouter' };
    const map: Array<{ match: string; keyName: string; provider: string }> = [
      { match: 'claude', keyName: 'anthropic_api_key', provider: 'anthropic' },
      { match: 'gpt', keyName: 'openai_api_key', provider: 'openai' },
      { match: 'gemini', keyName: 'google_ai_api_key', provider: 'google' },
    ];
    for (const pm of map) {
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!checkRateLimit(user.id)) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const validation = validateRequest(rawBody);
    if (!validation.valid) return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { model, messages, temperature, max_tokens, agent_id, session_id } = validation.data;
    const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const workspaceId = member?.workspace_id || validation.data.workspace_id;

    // ═══ GUARDRAILS ═══
    const gr = await checkGuardrails(supabase, agent_id, userMessage);
    if (!gr.passed) {
      recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userInput: userMessage, assistantOutput: '[BLOCKED]', model, provider: 'none', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, guardrailsTriggered: gr.triggered, event: 'guardrail_block', level: 'warn' });
      return new Response(JSON.stringify({ error: 'Blocked by guardrails', guardrails_triggered: gr.triggered }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ BUDGET ═══
    const budget = await checkBudget(supabase, workspaceId ?? undefined, agent_id);
    if (!budget.allowed) return new Response(JSON.stringify({ error: 'Budget exceeded', reason: budget.reason }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ═══ LLM CALL ═══
    const { apiKey, provider } = await resolveApiKey(supabase, workspaceId ?? undefined, model);
    if (!apiKey) return new Response(JSON.stringify({ error: 'No API key configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const startTime = Date.now();
    const callParams: LLMCallParams = { model, messages, temperature, max_tokens };
    const result = provider === 'lovable' ? await callLovable(callParams, apiKey)
      : provider === 'openrouter' ? await callOpenRouter(callParams, apiKey, supabaseUrl)
      : provider === 'anthropic' ? await callAnthropic(callParams, apiKey)
      : await callOpenAICompatible(callParams, apiKey, provider);

    const latencyMs = Date.now() - startTime;
    const costUsd = await calculateCost(supabase, model, result.usage.prompt_tokens, result.usage.completion_tokens);

    // ═══ TRACE (non-blocking) ═══
    recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userInput: userMessage, assistantOutput: result.content, model, provider, promptTokens: result.usage.prompt_tokens, completionTokens: result.usage.completion_tokens, totalTokens: result.usage.total_tokens, costUsd, latencyMs, guardrailsTriggered: gr.triggered, event: 'llm_call', level: 'info' });

    return new Response(JSON.stringify({
      content: result.content, model, provider,
      tokens: { prompt: result.usage.prompt_tokens, completion: result.usage.completion_tokens, total: result.usage.total_tokens },
      cost_usd: Math.round(costUsd * 1000000) / 1000000, latency_ms: latencyMs,
      finish_reason: result.finish_reason,
      guardrails_triggered: gr.triggered.length > 0 ? gr.triggered : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
