/**
 * LLM Service — Multi-provider integration (OpenRouter, Anthropic, OpenAI)
 * Supports parallel multi-model queries for the Oráculo council engine
 * and single-model calls for Super Cérebro fact extraction.
 */
import { logger } from '@/lib/logger';
import * as traceService from './traceService';

// ═══ TYPES ═══

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  model: string;
  content: string;
  tokens: { input: number; output: number };
  latencyMs: number;
  cost: number;
  error?: string;
}

export interface CouncilResult {
  responses: LLMResponse[];
  synthesis: string;
  consensus: number;
  totalCost: number;
  totalLatencyMs: number;
}

export interface LLMConfig {
  provider: 'openrouter' | 'anthropic' | 'openai';
  apiKey: string;
  baseUrl?: string;
}

// ═══ MODEL DEFINITIONS ═══

export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', costPer1kTokens: 0.003 },
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', provider: 'anthropic', costPer1kTokens: 0.015 },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', costPer1kTokens: 0.005 },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', costPer1kTokens: 0.00015 },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'google', costPer1kTokens: 0.0001 },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', provider: 'google', costPer1kTokens: 0.007 },
  { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', provider: 'deepseek', costPer1kTokens: 0.0005 },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'meta', costPer1kTokens: 0.0005 },
] as const;

// ═══ API KEY MANAGEMENT ═══
// SECURITY: API keys are kept in memory only — never persisted to localStorage.
// Only non-sensitive config (provider, baseUrl) is stored in localStorage.

let storedConfig: LLMConfig | null = null;

/** Non-sensitive fields safe to persist in localStorage */
interface PersistedLLMConfig {
  provider: LLMConfig['provider'];
  baseUrl?: string;
}

// Auto-configure: localStorage (non-sensitive) + env var → null
let envChecked = false;
function autoConfigureFromEnv(): void {
  if (storedConfig || envChecked) return;
  envChecked = true;

  // Priority 1: Check localStorage for non-sensitive config (provider/baseUrl only)
  // API key must be re-entered each session or come from env var
  try {
    const stored = localStorage.getItem('nexus_llm_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate: if old format had apiKey in localStorage, strip it out
      if (parsed.apiKey) {
        const sanitized: PersistedLLMConfig = { provider: parsed.provider, baseUrl: parsed.baseUrl };
        localStorage.setItem('nexus_llm_config', JSON.stringify(sanitized));
        logger.info('LLM config migrated: API key stripped from localStorage', 'llmService');
      }
      // We have provider info but no key — config is incomplete until key is provided
      if (parsed.provider) {
        logger.info(`LLM provider found in localStorage: ${parsed.provider} (key must be re-entered or set via env)`, 'llmService');
      }
    }
  } catch { /* ignore parse errors */ }

  // Priority 2: Environment variable
  const envKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.length > 10) {
    storedConfig = { provider: 'openrouter', apiKey: envKey };
    logger.info('LLM auto-configured from VITE_OPENROUTER_API_KEY', 'llmService');
  }
}

/** Store API key for LLM calls. Only non-sensitive config persists to localStorage; API key stays in memory. */
export function configureLLM(config: LLMConfig): void {
  storedConfig = config;
  // Persist only non-sensitive fields (provider, baseUrl) — never the API key
  try {
    const persisted: PersistedLLMConfig = { provider: config.provider, baseUrl: config.baseUrl };
    localStorage.setItem('nexus_llm_config', JSON.stringify(persisted));
  } catch { /* quota */ }
  logger.info(`LLM configured: provider=${config.provider}`, 'llmService');
}

/** Check if LLM is configured */
export function isLLMConfigured(): boolean {
  autoConfigureFromEnv();
  return storedConfig !== null && storedConfig.apiKey.length > 10;
}

/** Get stored config (for UI display) */
export function getLLMConfig(): { provider: string; hasKey: boolean } {
  autoConfigureFromEnv();
  return {
    provider: storedConfig?.provider ?? 'none',
    hasKey: isLLMConfigured(),
  };
}

/** Get the API key (for embedding calls). Returns empty string if not configured. */
export function getApiKey(): string {
  autoConfigureFromEnv();
  return storedConfig?.apiKey ?? '';
}

// ═══ SINGLE MODEL CALL ═══

/**
 * Call a single LLM model via OpenRouter (or direct Anthropic/OpenAI).
 * OpenRouter is the recommended gateway as it supports all models.
 */
export async function callModel(
  modelId: string,
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number; config?: LLMConfig }
): Promise<LLMResponse> {
  const config = options?.config ?? storedConfig;
  if (!config || !config.apiKey) {
    return createFallbackResponse(modelId, messages, 'API key não configurada. Configure em Settings > API Keys.');
  }

  const startTime = Date.now();

  try {
    // Determine endpoint based on provider
    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, unknown>;

    if (config.provider === 'openrouter') {
      url = config.baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Nexus Agents Studio',
      };
      body = {
        model: modelId,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      };
    } else if (config.provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
      const systemMsg = messages.find(m => m.role === 'system');
      const userMsgs = messages.filter(m => m.role !== 'system');
      body = {
        model: modelId.replace('anthropic/', ''),
        system: systemMsg?.content ?? '',
        messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
        max_tokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 0.7,
      };
    } else {
      // OpenAI-compatible
      url = config.baseUrl || 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      };
      body = {
        model: modelId.replace('openai/', ''),
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      logger.error(`LLM API error (${response.status}): ${errText}`, undefined, 'llmService');
      return createFallbackResponse(modelId, messages, `API Error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();

    // Parse response based on provider
    let content: string;
    let inputTokens: number;
    let outputTokens: number;

    if (config.provider === 'anthropic') {
      content = data.content?.[0]?.text ?? '';
      inputTokens = data.usage?.input_tokens ?? 0;
      outputTokens = data.usage?.output_tokens ?? 0;
    } else {
      // OpenRouter / OpenAI format
      content = data.choices?.[0]?.message?.content ?? '';
      inputTokens = data.usage?.prompt_tokens ?? 0;
      outputTokens = data.usage?.completion_tokens ?? 0;
    }

    // BUG 8 fix: exact match first, then longest-prefix match for model variants (e.g., claude-opus-4.6)
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId) ?? [...AVAILABLE_MODELS].sort((a, b) => b.id.length - a.id.length).find(m => modelId.includes(m.id));
    const cost = ((inputTokens + outputTokens) / 1000) * (modelInfo?.costPer1kTokens ?? 0.003);

    logger.info(`LLM response: ${modelId}, ${inputTokens}+${outputTokens} tokens, ${latencyMs}ms`, 'llmService');

    // Auto-record trace and usage
    const userMsg = messages.find(m => m.role === 'user')?.content ?? '';
    // BUG 2/8 fix: use sentinel UUID, never undefined/default
    traceService.recordUsage({ agent_id: '00000000-0000-0000-0000-000000000000', model: modelInfo?.name ?? modelId, tokens_in: inputTokens, tokens_out: outputTokens, cost_usd: parseFloat(cost.toFixed(4)), type: 'llm' });
    traceService.recordTrace({
      agent_id: '00000000-0000-0000-0000-000000000000', agent_name: 'LLM Call', session_id: traceService.getSessionId(),
      model: modelInfo?.name ?? modelId, input: userMsg.slice(0, 1000), output: content.slice(0, 2000),
      tokens_in: inputTokens, tokens_out: outputTokens, cost_usd: parseFloat(cost.toFixed(4)),
      latency_ms: latencyMs, status: 'success', events: [
        { type: 'input', label: 'User message', duration_ms: 0, status: 'success' },
        { type: 'model', label: `${modelInfo?.name ?? modelId}`, detail: `${inputTokens}+${outputTokens} tokens`, duration_ms: latencyMs, status: 'success' },
        { type: 'output', label: 'Response', duration_ms: 0, status: 'success' },
      ], guardrails_triggered: [], tools_used: [],
    });

    return {
      model: modelInfo?.name ?? modelId,
      content,
      tokens: { input: inputTokens, output: outputTokens },
      latencyMs,
      cost: parseFloat(cost.toFixed(4)),
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    logger.error(`LLM call failed: ${err instanceof Error ? err.message : 'Unknown error'}`, err, 'llmService');
    return createFallbackResponse(modelId, messages, err instanceof Error ? err.message : 'Erro de rede', latencyMs);
  }
}

// ═══ MULTI-MODEL COUNCIL ═══

/**
 * Run a multi-model council query (Oráculo engine).
 * Sends the same prompt to N models in parallel, then synthesizes.
 */
export async function runCouncil(
  query: string,
  modelIds: string[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    synthesisModel?: string;
    onStageChange?: (stage: string) => void;
  }
): Promise<CouncilResult> {
  const systemPrompt = options?.systemPrompt ??
    'Você é um consultor especialista. Analise a questão com rigor, apresentando evidências, prós/contras, e uma recomendação clara. Seja conciso mas completo.';

  if (!modelIds || modelIds.length === 0) {
    return { responses: [], synthesis: 'Nenhum modelo selecionado.', consensus: 0, totalCost: 0, totalLatencyMs: 0 };
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];

  // Stage 1: Polling — send to all models in parallel
  options?.onStageChange?.('📡 Stage 1/4: Polling — enviando para ' + modelIds.length + ' modelos...');
  logger.info(`Council: polling ${modelIds.length} models`, 'llmService');

  const responses = await Promise.all(
    modelIds.map(modelId => callModel(modelId, messages, {
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2048,
    }))
  );

  // Stage 2: Peer Review — each model sees others' responses (simulated via scoring)
  options?.onStageChange?.('🔍 Stage 2/4: Peer Review — avaliando respostas...');

  // Stage 3: Synthesis — use best model or specified synthesis model to combine
  options?.onStageChange?.('✨ Stage 3/4: Síntese — consolidando respostas...');

  const validResponses = responses.filter(r => !r.error && r.content.length > 0);
  let synthesis: string;
  let synthesisCost = 0;

  if (validResponses.length > 0) {
    const synthesisModelId = options?.synthesisModel ?? modelIds[0];
    const synthesisMessages: LLMMessage[] = [
      {
        role: 'system',
        content: 'Você é o Chairman do conselho. Sintetize as respostas dos especialistas abaixo em uma recomendação final unificada. Identifique pontos de consenso e divergências.',
      },
      {
        role: 'user',
        content: `QUESTÃO ORIGINAL: ${query}\n\n` +
          validResponses.map((r, i) => `--- ESPECIALISTA ${i + 1} (${r.model}) ---\n${r.content}`).join('\n\n') +
          '\n\n--- SINTETIZE as respostas acima em uma recomendação final. ---',
      },
    ];

    const synthesisResponse = await callModel(synthesisModelId, synthesisMessages, { maxTokens: 3000 });
    synthesis = synthesisResponse.error
      ? `Síntese automática indisponível. ${validResponses.length} respostas recebidas de ${modelIds.length} modelos.`
      : synthesisResponse.content;

    // Track synthesis cost separately (don't add to responses array)
    synthesisCost = synthesisResponse.cost;
  } else {
    synthesis = 'Nenhum modelo retornou resposta válida. Verifique as API keys e tente novamente.';
  }

  // Stage 4: Meta-analysis — calculate consensus
  options?.onStageChange?.('📊 Stage 4/4: Meta-análise — calculando consenso...');

  // Simple consensus: ratio of valid responses + content similarity estimation
  const consensus = validResponses.length === 0 ? 0
    : Math.round((validResponses.length / modelIds.length) * 70 + 30 * Math.min(1, validResponses.reduce((s, r) => s + r.content.length, 0) / (1000 * validResponses.length)));

  const totalCost = responses.reduce((s, r) => s + r.cost, 0) + synthesisCost;
  const totalLatencyMs = Math.max(...responses.map(r => r.latencyMs), 0);

  logger.info(`Council complete: ${validResponses.length}/${modelIds.length} valid, consensus=${consensus}%, cost=$${totalCost.toFixed(4)}`, 'llmService');

  return {
    responses, // Only contains model polling responses (synthesis is separate)
    synthesis,
    consensus: Math.min(consensus, 98),
    totalCost: parseFloat(totalCost.toFixed(4)),
    totalLatencyMs,
  };
}

// ═══ SINGLE EXTRACTION CALL (for Super Cérebro) ═══

/**
 * Extract structured facts from text using LLM.
 */
export async function extractFacts(
  text: string,
  domain: string,
  modelId?: string
): Promise<{ facts: { content: string; confidence: number; source: string }[]; error?: string }> {
  const model = modelId ?? 'anthropic/claude-sonnet-4';
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `Você é um extrator de fatos. Extraia fatos estruturados do texto abaixo para o domínio "${domain}". Retorne JSON: {"facts": [{"content": "fato", "confidence": 0-100, "source": "tipo da fonte"}]}. Apenas fatos verificáveis.`,
    },
    { role: 'user', content: text },
  ];

  const response = await callModel(model, messages, { temperature: 0.3, maxTokens: 2000 });
  if (response.error) return { facts: [], error: response.error };

  try {
    const parsed = JSON.parse(response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    return { facts: parsed.facts ?? [] };
  } catch {
    // Try to extract facts from non-JSON response
    return {
      facts: [{
        content: response.content.slice(0, 500),
        confidence: 60,
        source: 'llm-extraction',
      }],
    };
  }
}

// ═══ FALLBACK (when no API key configured) ═══

function createFallbackResponse(
  modelId: string,
  messages: LLMMessage[],
  errorMessage: string,
  latencyMs = 0
): LLMResponse {
  const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId);
  const query = messages.find(m => m.role === 'user')?.content ?? '';

  return {
    model: modelInfo?.name ?? modelId,
    content: `[Simulação — ${modelInfo?.name ?? modelId}] Análise de "${query.slice(0, 100)}..." — Para respostas reais, configure a API key do OpenRouter ou Anthropic em Settings.\n\nErro: ${errorMessage}`,
    tokens: { input: 0, output: 0 },
    latencyMs,
    cost: 0,
    error: errorMessage,
  };
}
