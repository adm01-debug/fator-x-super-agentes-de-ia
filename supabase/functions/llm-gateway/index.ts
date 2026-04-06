import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callLovable, callOpenRouter, callAnthropic, callOpenAICompatible, callHuggingFace, type LLMCallParams, type LLMResult } from "./providers.ts";
import { getCorsHeaders, handleCorsPreflight, checkRateLimit, getRateLimitIdentifier, createRateLimitResponse, RATE_LIMITS } from "../_shared/mod.ts";

// CORS handled by _shared/cors.ts — dynamic origin whitelist
// corsHeaders removed — using getCorsHeaders(req) from _shared/cors.ts

// Rate limiting uses shared _shared/rate-limiter.ts (imported via mod.ts)

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

// ═══ Prompt Injection Detection (ML — HuggingFace ProtectAI) ═══
const HF_INJECTION_MODEL = 'protectai/deberta-v3-base-prompt-injection-v2';
const HF_INJECTION_TIMEOUT_MS = 3000;

async function detectInjectionML(text: string): Promise<{ detected: boolean; label: string; score: number; method: 'ml' }> {
  const hfToken = Deno.env.get('HF_API_TOKEN');
  if (!hfToken || Deno.env.get('ENABLE_ML_INJECTION_CHECK') === 'false') {
    return { detected: false, label: 'skipped', score: 0, method: 'ml' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HF_INJECTION_TIMEOUT_MS);
    const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${HF_INJECTION_MODEL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
      body: JSON.stringify({ inputs: text.substring(0, 512) }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return { detected: false, label: 'api_error', score: 0, method: 'ml' };
    const result = await resp.json();
    const top = Array.isArray(result?.[0]) ? result[0][0] : result?.[0];
    if (!top?.label) return { detected: false, label: 'parse_error', score: 0, method: 'ml' };
    return {
      detected: top.label === 'INJECTION' && top.score > 0.85,
      label: top.label,
      score: top.score,
      method: 'ml',
    };
  } catch {
    return { detected: false, label: 'timeout', score: 0, method: 'ml' }; // fail-open
  }
}

// ═══ Prompt Injection Detection (Regex Fallback) ═══
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
  } catch (e) {
    // FAIL-OPEN by design: guardrail errors should not block user requests.
    // In production, monitor this via security_events table.
    console.error('[guardrails] Check failed, allowing request (fail-open):', e instanceof Error ? e.message : e);
    return { passed: true, triggered: [] };
  }
}

// ═══ Budget Check ═══
async function checkBudget(supabase: SupabaseClient, workspaceId: string | undefined, agentId: string | undefined): Promise<{ allowed: boolean; reason?: string }> {
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
            if ((agent?.config as Record<string, unknown>)?.budget_kill_switch) {
              return { allowed: false, reason: `Budget "${b.name}" exceeded: $${Number(b.current_usd).toFixed(4)} / $${b.limit_usd}` };
            }
          }
        }
      }
    }
  } catch (e) {
    // FAIL-OPEN by design: budget check errors should not block requests.
    console.error('[budget] Check failed, allowing request (fail-open):', e instanceof Error ? e.message : e);
  }
  return { allowed: true };
}

// ═══ Record Trace + Usage (non-blocking) ═══
async function recordTrace(supabase: SupabaseClient, p: {
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

async function resolveFallbackChain(supabase: SupabaseClient, workspaceId: string | undefined, requestedModel: string): Promise<ProviderOption[]> {
  const chain: ProviderOption[] = [];

  // 1. Direct provider mapping for requested model
  const providerMap: Array<{ match: string; keyName: string; provider: string }> = [
    { match: 'huggingface/', keyName: 'huggingface_api_key', provider: 'huggingface' },
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
    // Also check HF token from env as fallback for huggingface/ models
    if (requestedModel.startsWith('huggingface/') && !chain.some(c => c.provider === 'huggingface')) {
      const hfEnvToken = Deno.env.get('HF_API_TOKEN');
      if (hfEnvToken) chain.push({ apiKey: hfEnvToken, provider: 'huggingface', model: requestedModel, priority: 1 });
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
      const result = opt.provider === 'huggingface' ? await callHuggingFace(params, opt.apiKey)
        : opt.provider === 'lovable' ? await callLovable(params, opt.apiKey)
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
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    const rateCheck = checkRateLimit(getRateLimitIdentifier(req, user.id), RATE_LIMITS.llm);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck, getCorsHeaders(req));

    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }); }

    const validation = validateRequest(rawBody);
    if (!validation.valid) return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

    const { model, messages, temperature, max_tokens, agent_id, session_id, stream } = validation.data;
    const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const workspaceId = member?.workspace_id || validation.data.workspace_id;

    // ═══ TIMING START ═══
    const t0 = Date.now();

    // ═══ PROMPT INJECTION DETECTION (Layer 1: ML via HuggingFace) ═══
    const injectionML = await detectInjectionML(userMessage);
    if (injectionML.detected) {
      recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: '[INJECTION_BLOCKED_ML]', model, provider: 'none', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, guardrailsTriggered: [{ name: `ml_${injectionML.label}`, severity: 'block', reason: `ML score: ${injectionML.score.toFixed(4)}` }], event: 'injection_block_ml', level: 'critical' });
      return new Response(JSON.stringify({ error: 'Request blocked: prompt injection detected (ML)', detection: { label: injectionML.label, score: injectionML.score, method: 'ml' } }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ PROMPT INJECTION DETECTION (Layer 2: Regex fallback) ═══
    const injection = detectInjection(userMessage);
    if (injection.detected && injection.riskLevel === 'critical') {
      recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: '[INJECTION_BLOCKED]', model, provider: 'none', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, guardrailsTriggered: injection.patterns.map(p => ({ name: p, severity: 'block', reason: 'prompt_injection_regex' })), event: 'injection_block', level: 'critical' });
      return new Response(JSON.stringify({ error: 'Request blocked: potential prompt injection detected', patterns: injection.patterns }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ TOXICITY DETECTION (Layer 3: ML via HuggingFace) ═══
    const hfTokenTox = Deno.env.get('HF_API_TOKEN');
    let detectedLanguage: string | null = null;
    let toxicityScore = 0;
    if (hfTokenTox && Deno.env.get('ENABLE_TOXICITY_CHECK') !== 'false') {
      try {
        const toxResp = await fetch('https://router.huggingface.co/hf-inference/models/unitary/toxic-bert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfTokenTox}` },
          body: JSON.stringify({ inputs: userMessage.substring(0, 512) }),
          signal: AbortSignal.timeout(3000),
        });
        if (toxResp.ok) {
          const toxResult = await toxResp.json();
          const labels = Array.isArray(toxResult?.[0]) ? toxResult[0] : toxResult;
          if (Array.isArray(labels)) {
            const toxic = labels.find((l: any) => l.label === 'toxic');
            toxicityScore = toxic?.score || 0;
            if (toxicityScore > 0.85) {
              recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: '[TOXICITY_BLOCKED]', model, provider: 'none', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, guardrailsTriggered: [{ name: 'toxicity', severity: 'block', reason: `toxic score: ${toxicityScore.toFixed(4)}` }], event: 'toxicity_block', level: 'warning' });
              return new Response(JSON.stringify({ error: 'Request blocked: toxic content detected', score: toxicityScore }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
            }
          }
        }
      } catch { /* toxicity check is optional, ignore errors */ }
    }

    // ═══ LANGUAGE DETECTION (fire-and-forget metadata enrichment) ═══
    if (hfTokenTox && Deno.env.get('ENABLE_LANGUAGE_DETECTION') !== 'false') {
      try {
        const langResp = await fetch('https://router.huggingface.co/hf-inference/models/papluca/xlm-roberta-base-language-detection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfTokenTox}` },
          body: JSON.stringify({ inputs: userMessage.substring(0, 200) }),
          signal: AbortSignal.timeout(2000),
        });
        if (langResp.ok) {
          const langResult = await langResp.json();
          const labels = Array.isArray(langResult?.[0]) ? langResult[0] : langResult;
          if (Array.isArray(labels) && labels.length > 0) {
            const sorted = [...labels].sort((a: any, b: any) => b.score - a.score);
            detectedLanguage = sorted[0]?.label || null;
          }
        }
      } catch { /* language detection is optional */ }
    }

    // ═══ PII REDACTION (input) ═══
    const pii = redactPII(userMessage);

    // #46 — PII Detection ML (Piiranha, 98.27% recall, 17 PII types)
    const hfPiiToken = Deno.env.get('HF_API_TOKEN');
    if (hfPiiToken && Deno.env.get('ENABLE_PII_ML') !== 'false' && pii.detected.length === 0) {
      // Only run ML if regex didn't catch anything (avoid double-processing)
      try {
        const piiResp = await fetch('https://router.huggingface.co/hf-inference/models/iiiorg/piiranha-v1-detect-personal-information', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfPiiToken}` },
          body: JSON.stringify({ inputs: userMessage.substring(0, 512) }),
          signal: AbortSignal.timeout(3000),
        });
        if (piiResp.ok) {
          const piiEntities = await piiResp.json();
          if (Array.isArray(piiEntities) && piiEntities.length > 0) {
            const mlPii = piiEntities
              .filter((e: Record<string, unknown>) => (e.score as number) > 0.85 && e.entity_group !== 'O')
              .map((e: Record<string, unknown>) => `${e.entity_group}: ${String(e.word || '').substring(0, 20)}***`);
            if (mlPii.length > 0) {
              pii.detected.push(...mlPii.map((p: string) => `ML:${p}`));
            }
          }
        }
      } catch { /* ML PII is optional, timeout ok */ }
    }

    const safeMessages = pii.detected.length > 0
      ? messages.map(m => m.role === 'user' && m.content === userMessage ? { ...m, content: pii.redacted } : m)
      : messages;

    // ═══ AGENTIC GUARDRAIL (#43) — Multi-turn jailbreak + tool manipulation detection ═══
    let agenticRisk: string | null = null;
    const hfAgenticToken = Deno.env.get('HF_API_TOKEN');
    if (hfAgenticToken && Deno.env.get('ENABLE_AGENTIC_GUARDRAIL') !== 'false' && messages.length > 2) {
      // Only check multi-turn conversations (single-turn already covered by injection ML)
      try {
        const conversationContext = messages.slice(-4).map((m: { role: string; content: string }) => `${m.role}: ${m.content.substring(0, 200)}`).join('\n');
        const agResp = await fetch('https://router.huggingface.co/hf-inference/models/joeddav/xlm-roberta-large-xnli', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfAgenticToken}` },
          body: JSON.stringify({
            inputs: conversationContext.substring(0, 800),
            parameters: { candidate_labels: ['normal_conversation', 'jailbreak_attempt', 'tool_manipulation', 'data_extraction', 'role_override'] },
          }),
          signal: AbortSignal.timeout(3000),
        });
        if (agResp.ok) {
          const agResult = await agResp.json();
          if (agResult?.labels?.[0] !== 'normal_conversation' && agResult?.scores?.[0] > 0.7) {
            agenticRisk = `${agResult.labels[0]}:${Math.round(agResult.scores[0] * 100)}%`;
            // Log but don't block — let the standard guardrails handle blocking
          }
        }
      } catch { /* non-blocking */ }
    }

    // ═══ GUARDRAILS ═══
    const gr = await checkGuardrails(supabase, agent_id, userMessage);
    if (!gr.passed) {
      recordTrace(supabase, { workspaceId, agentId: agent_id, sessionId: session_id, userId: user.id, userInput: userMessage, assistantOutput: '[BLOCKED]', model, provider: 'none', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, latencyMs: 0, guardrailsTriggered: gr.triggered, event: 'guardrail_block', level: 'warning' });
      return new Response(JSON.stringify({ error: 'Blocked by guardrails', guardrails_triggered: gr.triggered }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ BUDGET ═══
    const budget = await checkBudget(supabase, workspaceId ?? undefined, agent_id);
    if (!budget.allowed) return new Response(JSON.stringify({ error: 'Budget exceeded', reason: budget.reason }), { status: 402, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

    // ═══ RESOLVE PROVIDER CHAIN ═══
    const chain = await resolveFallbackChain(supabase, workspaceId ?? undefined, model);
    if (chain.length === 0) return new Response(JSON.stringify({ error: 'No API key configured for any provider' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

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
      return new Response(readable, { headers: { ...getCorsHeaders(req), 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
    }

    // ═══ NON-STREAMING LLM CALL — with fallback chain ═══
    const tPreCall = Date.now();
    const guardrailMs = tPreCall - t0; // includes injection + PII + guardrails + budget
    const chain2 = await resolveFallbackChain(supabase, workspaceId ?? undefined, model);
    if (chain2.length === 0) return new Response(JSON.stringify({ error: 'No API key configured for any provider' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

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

    // ═══ OUTPUT GUARDRAILS (fire-and-forget) ═══
    const hfOutputToken = Deno.env.get('HF_API_TOKEN');
    let outputToxicityScore = 0;
    let hallucinationScore: number | null = null;

    // #33 — Output Toxicity Check (toxic-bert on LLM response)
    if (hfOutputToken && Deno.env.get('ENABLE_OUTPUT_TOXICITY') !== 'false' && result.content) {
      try {
        const otResp = await fetch('https://router.huggingface.co/hf-inference/models/unitary/toxic-bert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfOutputToken}` },
          body: JSON.stringify({ inputs: result.content.substring(0, 512) }),
        });
        if (otResp.ok) {
          const otResult = await otResp.json();
          const toxicLabel = Array.isArray(otResult?.[0]) ? otResult[0].find((l: Record<string, unknown>) => l.label === 'toxic') : null;
          outputToxicityScore = toxicLabel?.score || 0;
          // If output is highly toxic, flag but don't block (user asked the question)
        }
      } catch { /* non-blocking */ }
    }

    // #29 — Hallucination Detection (NLI check: is response grounded in context?)
    if (hfOutputToken && Deno.env.get('ENABLE_HALLUCINATION_CHECK') !== 'false' && result.content) {
      try {
        // Only check if there was RAG context in the messages
        const systemMsg = (messages || []).find((m: Record<string, string>) => m.role === 'system')?.content || '';
        const hasContext = systemMsg.length > 200; // Likely has RAG context if system prompt is long
        if (hasContext) {
          const nliResp = await fetch('https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfOutputToken}` },
            body: JSON.stringify({
              inputs: `${systemMsg.substring(0, 800)}. ${result.content.substring(0, 300)}`,
              parameters: { candidate_labels: ['grounded', 'hallucinated'] },
            }),
          });
          if (nliResp.ok) {
            const nliResult = await nliResp.json();
            const hallIdx = nliResult?.labels?.indexOf('hallucinated');
            hallucinationScore = hallIdx >= 0 ? Math.round(nliResult.scores[hallIdx] * 100) / 100 : null;
          }
        }
      } catch { /* non-blocking */ }
    }

    // ═══ CONSOLIDATED TRACE ENRICHMENT (C3 fix: single update, no race condition) ═══
    const hfTokenClassify = Deno.env.get('HF_API_TOKEN');
    if (hfTokenClassify) {
      // Run all enrichments in parallel, then do ONE metadata update
      (async () => {
        const metadata: Record<string, unknown> = {};
        // Add pre-computed values
        if (detectedLanguage) metadata.detected_language = detectedLanguage;
        if (toxicityScore > 0.1) metadata.toxicity_score = Math.round(toxicityScore * 1000) / 1000;
        if (outputToxicityScore > 0.1) metadata.output_toxicity = Math.round(outputToxicityScore * 1000) / 1000;
        if (hallucinationScore !== null && hallucinationScore > 0.3) metadata.hallucination_risk = hallucinationScore;
        if (agenticRisk) metadata.agentic_risk = agenticRisk;

        const enrichmentPromises: Array<Promise<void>> = [];

        // Auto-classification
        if (Deno.env.get('ENABLE_AUTO_CLASSIFY') !== 'false') {
          enrichmentPromises.push(
            fetch('https://router.huggingface.co/hf-inference/models/joeddav/xlm-roberta-large-xnli', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfTokenClassify}` },
              body: JSON.stringify({ inputs: userMessage.substring(0, 500), parameters: { candidate_labels: ['comercial', 'suporte', 'produto', 'financeiro', 'logística', 'rh', 'técnico', 'criativo'] } }),
              signal: AbortSignal.timeout(5000),
            }).then(r => r.json()).then(cr => {
              if (cr?.labels?.[0] && cr?.scores?.[0] > 0.3) {
                metadata.auto_category = cr.labels[0];
                metadata.auto_category_score = Math.round(cr.scores[0] * 100) / 100;
                metadata.auto_categories_top3 = cr.labels.slice(0, 3);
              }
            }).catch(() => {})
          );
        }

        // Emotion detection
        if (Deno.env.get('ENABLE_EMOTION_DETECTION') !== 'false') {
          enrichmentPromises.push(
            fetch('https://router.huggingface.co/hf-inference/models/j-hartmann/emotion-english-distilroberta-base', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfTokenClassify}` },
              body: JSON.stringify({ inputs: userMessage.substring(0, 512) }),
              signal: AbortSignal.timeout(5000),
            }).then(r => r.json()).then(er => {
              const emotions = Array.isArray(er?.[0]) ? er[0] : er;
              if (Array.isArray(emotions) && emotions.length > 0) {
                const sorted = [...emotions].sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.score as number) - (a.score as number));
                metadata.emotion = sorted[0]?.label;
                metadata.emotion_score = Math.round((sorted[0]?.score as number) * 100) / 100;
              }
            }).catch(() => {})
          );
        }

        // Keyphrase extraction
        if (Deno.env.get('ENABLE_KEYPHRASE_EXTRACTION') !== 'false' && userMessage.length > 30) {
          enrichmentPromises.push(
            fetch('https://router.huggingface.co/hf-inference/models/ml6team/keyphrase-extraction-kbir-inspec', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfTokenClassify}` },
              body: JSON.stringify({ inputs: userMessage.substring(0, 500) }),
              signal: AbortSignal.timeout(5000),
            }).then(r => r.json()).then(kp => {
              if (Array.isArray(kp) && kp.length > 0) {
                const keyphrases = kp.filter((k: Record<string, unknown>) => (k.score as number) > 0.5).map((k: Record<string, unknown>) => k.word).slice(0, 5);
                if (keyphrases.length > 0) metadata.keyphrases = keyphrases;
              }
            }).catch(() => {})
          );
        }

        // Wait for ALL enrichments to complete
        await Promise.allSettled(enrichmentPromises);

        // Single atomic update with ALL metadata merged
        if (Object.keys(metadata).length > 0) {
          supabase.from('agent_traces')
            .update({ metadata })
            .eq('agent_id', agent_id || '00000000-0000-0000-0000-000000000000')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .then(() => {});
        }
      })().catch(() => {}); // entire enrichment block is non-blocking
    }

    return new Response(JSON.stringify({
      content: result.content, model: usedModel, provider,
      tokens: { prompt: result.usage.prompt_tokens, completion: result.usage.completion_tokens, total: result.usage.total_tokens },
      cost_usd: Math.round(costUsd * 1000000) / 1000000, latency_ms: totalMs,
      latency_breakdown: latencyBreakdown,
      finish_reason: result.finish_reason,
      pii_detected: pii.detected.length > 0 ? pii.detected : undefined,
      injection_risk: injection.detected ? injection.riskLevel : (injectionML.label !== 'skipped' ? `ml_scanned:${injectionML.label}` : undefined),
      detected_language: detectedLanguage || undefined,
      toxicity_score: toxicityScore > 0.1 ? Math.round(toxicityScore * 1000) / 1000 : undefined,
      fallback: attempt > 1 ? { attempt, requested_model: model, used_model: usedModel, errors: fallbackErrors } : undefined,
      guardrails_triggered: gr.triggered.length > 0 ? gr.triggered : undefined,
      output_toxicity: outputToxicityScore > 0.1 ? Math.round(outputToxicityScore * 1000) / 1000 : undefined,
      hallucination_risk: hallucinationScore !== null && hallucinationScore > 0.3 ? hallucinationScore : undefined,
      agentic_risk: agenticRisk || undefined,
    }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
  }
});
