import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callLovable, callOpenRouter, callAnthropic, callOpenAICompatible, type LLMCallParams, type LLMResult } from "./providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══ Rate Limiting ═══
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
// Clean stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const fresh = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, fresh);
  }
}, 300_000);

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
  stream: boolean;
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
      stream: b.stream === true,
    },
  };
}

// ═══ Cost Calculation from DB pricing ═══
async function calculateCost(supabase: SupabaseClient, model: string, promptTokens: number, completionTokens: number): Promise<number> {
  try {
    const { data: pricing } = await supabase.from('model_pricing').select('model_pattern, input_cost_per_1k, output_cost_per_1k');
    if (pricing) {
      // Sort by pattern length DESC so "gpt-4o-mini" matches before "gpt-4o"
      const sorted = [...pricing].sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.model_pattern as string).length - (a.model_pattern as string).length);
      for (const p of sorted) {
        if (model.includes(p.model_pattern)) {
          return (promptTokens / 1000 * Number(p.input_cost_per_1k)) + (completionTokens / 1000 * Number(p.output_cost_per_1k));
        }
      }
    }
  } catch { /* fallback */ }
  return (promptTokens + completionTokens) * 0.000003;
}

// ═══ PII Detection (Brazilian + International) ═══
const PII_PATTERNS = [
  { name: 'cpf', regex: /\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}\b/g, repl: '[CPF]' },
  { name: 'cnpj', regex: /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[.\s-]?\d{2}\b/g, repl: '[CNPJ]' },
  { name: 'phone_br', regex: /\b(?:\+55\s?)?(?:\(?\d{2}\)?\s?)(?:9\s?\d{4}[-.\s]?\d{4}|\d{4}[-.\s]?\d{4})\b/g, repl: '[PHONE]' },
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, repl: '[EMAIL]' },
  { name: 'credit_card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, repl: '[CARD]' },
];

function redactPII(text: string): { redacted: string; detected: string[] } {
  let redacted = text;
  const detected: string[] = [];
  for (const p of PII_PATTERNS) {
    if (p.regex.test(text)) { detected.push(p.name); redacted = redacted.replace(p.regex, p.repl); }
    p.regex.lastIndex = 0; // reset global regex
  }
  return { redacted, detected };
}

// ═══ Prompt Injection Detection ═══
const INJECTION_PATTERNS = [
  { name: 'ignore_previous', regex: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i, sev: 'high' },
  { name: 'new_instructions', regex: /(?:new|override)\s+(?:system\s+)?instructions?:?\s/i, sev: 'high' },
  { name: 'you_are_now', regex: /you\s+are\s+now\s+(?:a|an|the)\s/i, sev: 'high' },
  { name: 'dan_jailbreak', regex: /(?:DAN|do\s+anything\s+now|jailbreak|developer\s+mode)/i, sev: 'high' },
  { name: 'reveal_system', regex: /(?:reveal|show|output|repeat)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?)/i, sev: 'high' },
  { name: 'system_role', regex: /\[?\s*system\s*\]?\s*:/i, sev: 'high' },
  { name: 'end_of_prompt', regex: /(?:END\s+OF\s+(?:SYSTEM\s+)?PROMPT|<\|endoftext\|>)/i, sev: 'high' },
  { name: 'pretend_evil', regex: /(?:pretend|act|behave)\s+(?:to\s+be|as\s+if|like)\s+.*(?:evil|malicious|unfiltered)/i, sev: 'high' },
];

function detectInjection(text: string): { detected: boolean; patterns: string[]; riskLevel: string } {
  const patterns: string[] = [];
  for (const p of INJECTION_PATTERNS) {
    if (p.regex.test(text)) patterns.push(p.name);
  }
  const riskLevel = patterns.length >= 2 ? 'critical' : patterns.length === 1 ? 'high' : 'none';
  return { detected: patterns.length > 0, patterns, riskLevel };
}

// ═══ Guardrails Check ═══
async function checkGuardrails(supabase: SupabaseClient, agentId: string | undefined, userMessage: string): Promise<{ passed: boolean; triggered: Array<{ name: string; severity: string; reason: string }> }> {
  if (!agentId) return { passed: true, triggered: [] };
  try {
    const { data: agent } = await supabase.from('agents').select('config').eq('id', agentId).single();
    if (!agent?.config) return { passed: true, triggered: [] };
    const config = agent.config as Record<string, unknown>;
    const guardrails = (config.guardrails || []) as Array<{ enabled: boolean; name: string; category: string; severity: string; config?: Record<string, unknown> }>;
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
          // Check agent-level kill switch OR workspace-level (over 120% = always block)
          const overBy = Number(b.current_usd) / Number(b.limit_usd);
          if (overBy >= 1.2) {
            return { allowed: false, reason: `Budget "${b.name}" critically exceeded (${(overBy*100).toFixed(0)}%): $${Number(b.current_usd).toFixed(4)} / $${b.limit_usd}` };
          }
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
  workspaceId?: string; agentId?: string; sessionId?: string; userId?: string;
  userInput: string; assistantOutput: string; model: string; provider: string;
  promptTokens: number; completionTokens: number; totalTokens: number;
  costUsd: number; latencyMs: number; guardrailsTriggered: any[];
  event: string; level: string;
}) {
  try {
    // 1. agent_traces (primary observability)
    await supabase.from('agent_traces').insert({
      agent_id: p.agentId || '00000000-0000-0000-0000-000000000000',
      user_id: p.userId,
      workspace_id: p.workspaceId, session_id: p.sessionId,
      event: p.event, level: p.level, latency_ms: p.latencyMs, tokens_used: p.totalTokens,
      cost_usd: p.costUsd,
      input: { user_message: p.userInput, model: p.model, provider: p.provider },
      output: { content: p.assistantOutput?.substring(0, 5000) },
      metadata: { prompt_tokens: p.promptTokens, completion_tokens: p.completionTokens, guardrails: p.guardrailsTriggered },
    });

    // 2. Sessions lifecycle — upsert session + insert session_trace
    if (p.sessionId && p.userId) {
      // Upsert session (create if new, update last activity)
      const agentId = p.agentId || '00000000-0000-0000-0000-000000000000';
      const { data: existingSession } = await (supabase as any).from('sessions').select('id').eq('id', p.sessionId).maybeSingle();
      if (!existingSession) {
        await (supabase as any).from('sessions').insert({ id: p.sessionId, agent_id: agentId, user_id: p.userId, status: 'active' }).catch(() => {});
      }
      // Insert session_trace
      const { data: strace } = await (supabase as any).from('session_traces').insert({
        session_id: p.sessionId, trace_type: p.event,
        input: { message: p.userInput }, output: { content: p.assistantOutput?.substring(0, 2000) },
        latency_ms: p.latencyMs, tokens_used: p.totalTokens, cost_usd: p.costUsd,
        metadata: { model: p.model, provider: p.provider },
      }).select('id').single().catch(() => null);
      // Insert trace_event
      if (strace?.data?.id) {
        await (supabase as any).from('trace_events').insert({ session_trace_id: strace.data.id, event_type: p.event, data: { level: p.level, guardrails: p.guardrailsTriggered } }).catch(() => {});
      }
    }

    // 3. usage_records
    if (p.workspaceId) {
      await supabase.from('usage_records').insert({
        workspace_id: p.workspaceId, agent_id: p.agentId || null, record_type: 'llm_call',
        tokens: p.totalTokens, cost_usd: p.costUsd,
        metadata: { model: p.model, provider: p.provider, latency_ms: p.latencyMs },
      });
      // 4. Daily aggregate
      if (p.userId) {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase.from('agent_usage').select('id, requests, tokens_input, tokens_output, total_cost_usd').eq('agent_id', p.agentId || '00000000-0000-0000-0000-000000000000').eq('user_id', p.userId).eq('date', today).maybeSingle();
        if (existing) {
          await supabase.from('agent_usage').update({ requests: (existing.requests||0)+1, tokens_input: (existing.tokens_input||0)+p.promptTokens, tokens_output: (existing.tokens_output||0)+p.completionTokens, total_cost_usd: (existing.total_cost_usd||0)+p.costUsd }).eq('id', existing.id);
        } else {
          await supabase.from('agent_usage').insert({ agent_id: p.agentId || '00000000-0000-0000-0000-000000000000', user_id: p.userId, date: today, requests: 1, tokens_input: p.promptTokens, tokens_output: p.completionTokens, total_cost_usd: p.costUsd }).catch(()=>{});
        }
      }
    }
  } catch (e: unknown) { console.error('Trace failed:', e instanceof Error ? e.message : e); }
}

// ═══ API Key Resolution — Fallback Chain ═══
interface ProviderOption { apiKey: string; provider: string; model: string; priority: number }

async function resolveFallbackChain(supabase: any, workspaceId: string | undefined, requestedModel: string): Promise<ProviderOption[]> {
  const chain: ProviderOption[] = [];

  // 1. Direct provider mapping for requested model
  const providerMap: Array<{ match: string; keyName: string; provider: string }> = [
    { match: 'claude', keyName: 'anthropic_api_key', provider: 'anthropic' },
    { match: 'gpt', keyName: 'openai_api_key', provider: 'openai' },
    { match: 'gemini', keyName: 'google_ai_api_key', provider: 'google' },
  ];

  if (workspaceId) {
    // Primary: direct provider for the model
    for (const pm of providerMap) {
      if (requestedModel.includes(pm.match)) {
        const { data: k } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', pm.keyName).single();
        if (k?.key_value) chain.push({ apiKey: k.key_value, provider: pm.provider, model: requestedModel, priority: 1 });
        break;
      }
    }
    // Secondary: OpenRouter as universal fallback (supports all models)
    const { data: orKey } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', 'openrouter_api_key').single();
    if (orKey?.key_value) chain.push({ apiKey: orKey.key_value, provider: 'openrouter', model: requestedModel, priority: 2 });
    // Tertiary: other providers with model mapping (cross-provider fallback)
    const fallbackModels: Record<string, string> = {
      'claude': 'gpt-4o', 'gpt': 'claude-sonnet-4-20250514', 'gemini': 'gpt-4o',
    };
    for (const pm of providerMap) {
      if (!requestedModel.includes(pm.match)) {
        const { data: k } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', workspaceId).eq('key_name', pm.keyName).single();
        if (k?.key_value) {
          const modelPrefix = Object.keys(fallbackModels).find(p => requestedModel.includes(p));
          const fallbackModel = modelPrefix ? fallbackModels[modelPrefix] : requestedModel;
          chain.push({ apiKey: k.key_value, provider: pm.provider, model: fallbackModel, priority: 3 });
        }
      }
    }
  }
  // Last resort: Lovable API key from env
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (lovableApiKey) chain.push({ apiKey: lovableApiKey, provider: 'lovable', model: requestedModel, priority: 4 });

  return chain.sort((a, b) => a.priority - b.priority);
}

// ═══ Call with Fallback — tries each provider in chain ═══
async function callWithFallback(
  chain: ProviderOption[], callParams: LLMCallParams, supabaseUrl: string
): Promise<{ result: LLMResult; provider: string; model: string; attempt: number; errors: string[] }> {
  const errors: string[] = [];

  for (let i = 0; i < chain.length; i++) {
    const opt = chain[i];
    try {
      const params = { ...callParams, model: opt.model };
      const result = opt.provider === 'lovable' ? await callLovable(params, opt.apiKey)
        : opt.provider === 'openrouter' ? await callOpenRouter(params, opt.apiKey, supabaseUrl)
        : opt.provider === 'anthropic' ? await callAnthropic(params, opt.apiKey)
        : await callOpenAICompatible(params, opt.apiKey, opt.provider);

      return { result, provider: opt.provider, model: opt.model, attempt: i + 1, errors };
    } catch (err) {
      const errMsg = `[${opt.provider}/${opt.model}] ${err instanceof Error ? err.message : 'Unknown error'}`;
      errors.push(errMsg);
      console.error(`Fallback attempt ${i + 1} failed:`, errMsg);
      // Continue to next provider
    }
  }
  throw new Error(`All ${chain.length} providers failed: ${errors.join(' | ')}`);
}

// ═══ Main Handler ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!checkRateLimit(user.id)) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const validation = validateRequest(rawBody);
    if (!validation.valid) return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { model, messages, temperature, max_tokens, agent_id, session_id, stream } = validation.data;
    const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const workspaceId = member?.workspace_id || validation.data.workspace_id;

    // ═══ TIMING START ═══
    const t0 = Date.now();

    // ═══ PROMPT INJECTION DETECTION ═══
    const injection = detectInjection(userMessage);
    if (injection.detected && injection.riskLevel === 'critical') {
      recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: '[INJECTION_BLOCKED]', model, provider: 'none', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, guardrailsTriggered: injection.patterns.map(p => ({ name: p, severity: 'block', reason: 'prompt_injection' })), event: 'injection_block', level: 'critical' });
      return new Response(JSON.stringify({ error: 'Request blocked: potential prompt injection detected', patterns: injection.patterns }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ PII REDACTION (input) ═══
    const pii = redactPII(userMessage);
    const safeMessages = pii.detected.length > 0
      ? messages.map(m => m.role === 'user' && m.content === userMessage ? { ...m, content: pii.redacted } : m)
      : messages;

    // ═══ GUARDRAILS ═══
    const gr = await checkGuardrails(supabase, agent_id, userMessage);
    if (!gr.passed) {
      recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: '[BLOCKED]', model, provider: 'none', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, guardrailsTriggered: gr.triggered, event: 'guardrail_block', level: 'warning' });
      return new Response(JSON.stringify({ error: 'Blocked by guardrails', guardrails_triggered: gr.triggered }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ BUDGET ═══
    const budget = await checkBudget(supabase, workspaceId ?? undefined, agent_id);
    if (!budget.allowed) return new Response(JSON.stringify({ error: 'Budget exceeded', reason: budget.reason }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ═══ RESOLVE PROVIDER CHAIN ═══
    const chain = await resolveFallbackChain(supabase, workspaceId ?? undefined, model);
    if (chain.length === 0) return new Response(JSON.stringify({ error: 'No API key configured for any provider' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ═══ STREAMING SSE BRANCH ═══
    if (stream) {
      const opt = chain[0]; // Use primary provider for streaming
      const startTime = Date.now();
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let fullContent = '';
            let promptTokens = 0, completionTokens = 0;
            // Build streaming request to provider
            const isAnthropic = opt.provider === 'anthropic';
            const url = isAnthropic ? 'https://api.anthropic.com/v1/messages'
              : opt.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions'
              : 'https://api.openai.com/v1/chat/completions';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (isAnthropic) { headers['x-api-key'] = opt.apiKey; headers['anthropic-version'] = '2023-06-01'; }
            else { headers['Authorization'] = `Bearer ${opt.apiKey}`; }
            const body = isAnthropic
              ? JSON.stringify({ model: opt.model, messages: safeMessages.filter(m => m.role !== 'system'), system: safeMessages.find(m => m.role === 'system')?.content, max_tokens, temperature, stream: true })
              : JSON.stringify({ model: opt.model, messages: safeMessages, temperature, max_tokens, stream: true });
            const resp = await fetch(url, { method: 'POST', headers, body });
            if (!resp.ok || !resp.body) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Provider error: ${resp.status}` })}\n\n`));
              controller.close(); return;
            }
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data: ') || line === 'data: [DONE]') {
                  if (line === 'data: [DONE]') controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }
                try {
                  const parsed = JSON.parse(line.substring(6));
                  let token = '';
                  if (isAnthropic) {
                    if (parsed.type === 'content_block_delta') token = parsed.delta?.text || '';
                    if (parsed.type === 'message_delta') { completionTokens = parsed.usage?.output_tokens || completionTokens; }
                    if (parsed.type === 'message_start') { promptTokens = parsed.message?.usage?.input_tokens || 0; }
                  } else {
                    token = parsed.choices?.[0]?.delta?.content || '';
                    if (parsed.usage) { promptTokens = parsed.usage.prompt_tokens || 0; completionTokens = parsed.usage.completion_tokens || 0; }
                  }
                  if (token) {
                    fullContent += token;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, model: opt.model, provider: opt.provider })}\n\n`));
                  }
                } catch { /* skip unparseable lines */ }
              }
            }
            // Final summary event
            const latencyMs = Date.now() - startTime;
            const totalTokens = promptTokens + completionTokens;
            const costUsd = await calculateCost(supabase, opt.model, promptTokens, completionTokens);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, model: opt.model, provider: opt.provider, tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens }, cost_usd: costUsd, latency_ms: latencyMs })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            // Record trace (non-blocking)
            recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: fullContent, model: opt.model, provider: opt.provider, promptTokens, completionTokens, totalTokens, costUsd, latencyMs, guardrailsTriggered: gr.triggered, event: 'llm_call_stream', level: 'info' });
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream error' })}\n\n`));
            controller.close();
          }
        }
      });
      return new Response(readable, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
    }

    // ═══ NON-STREAMING LLM CALL — with fallback chain ═══
    const tPreCall = Date.now();
    const guardrailMs = tPreCall - t0; // includes injection + PII + guardrails + budget
    const chain2 = await resolveFallbackChain(supabase, workspaceId ?? undefined, model);
    if (chain2.length === 0) return new Response(JSON.stringify({ error: 'No API key configured for any provider' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const startTime = Date.now();
    const callParams: LLMCallParams = { model, messages: safeMessages, temperature, max_tokens };
    const { result, provider, model: usedModel, attempt, errors: fallbackErrors } = await callWithFallback(chain2, callParams, supabaseUrl);

    const latencyMs = Date.now() - startTime;
    const llmMs = latencyMs; // LLM call time
    const totalMs = Date.now() - t0; // end-to-end
    const costUsd = await calculateCost(supabase, usedModel, result.usage.prompt_tokens, result.usage.completion_tokens);
    const latencyBreakdown = { guardrail_ms: guardrailMs, llm_ms: llmMs, total_ms: totalMs };

    // ═══ TRACE (non-blocking) ═══
    recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: result.content, model: usedModel, provider, promptTokens: result.usage.prompt_tokens, completionTokens: result.usage.completion_tokens, totalTokens: result.usage.total_tokens, costUsd, latencyMs: totalMs, guardrailsTriggered: gr.triggered, event: 'llm_call', level: fallbackErrors.length > 0 ? 'warning' : injection.detected ? 'warning' : 'info' });

    return new Response(JSON.stringify({
      content: result.content, model: usedModel, provider,
      tokens: { prompt: result.usage.prompt_tokens, completion: result.usage.completion_tokens, total: result.usage.total_tokens },
      cost_usd: Math.round(costUsd * 1000000) / 1000000, latency_ms: totalMs,
      latency_breakdown: latencyBreakdown,
      finish_reason: result.finish_reason,
      pii_detected: pii.detected.length > 0 ? pii.detected : undefined,
      injection_risk: injection.detected ? injection.riskLevel : undefined,
      fallback: attempt > 1 ? { attempt, requested_model: model, used_model: usedModel, errors: fallbackErrors } : undefined,
      guardrails_triggered: gr.triggered.length > 0 ? gr.triggered : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
