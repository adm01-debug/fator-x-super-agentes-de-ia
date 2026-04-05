/**
 * OpenTelemetry GenAI Semantic Conventions for Nexus
 * Spec: https://opentelemetry.io/docs/specs/semconv/gen-ai/
 *
 * Standard attribute names for LLM tracing, compatible with
 * Langfuse, Arize Phoenix, Weights & Biases, Datadog LLM.
 */

// GenAI Semantic Convention attribute keys
export const GEN_AI = {
  // System
  SYSTEM: 'gen_ai.system',                      // 'anthropic', 'openai', 'openrouter'
  REQUEST_MODEL: 'gen_ai.request.model',         // 'claude-sonnet-4-20250514'
  RESPONSE_MODEL: 'gen_ai.response.model',       // actual model used

  // Token usage
  REQUEST_MAX_TOKENS: 'gen_ai.request.max_tokens',
  USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
  USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',
  USAGE_TOTAL_TOKENS: 'gen_ai.usage.total_tokens',

  // Request params
  REQUEST_TEMPERATURE: 'gen_ai.request.temperature',
  REQUEST_TOP_P: 'gen_ai.request.top_p',
  REQUEST_STOP_SEQUENCES: 'gen_ai.request.stop_sequences',
  REQUEST_FREQUENCY_PENALTY: 'gen_ai.request.frequency_penalty',

  // Response
  RESPONSE_FINISH_REASON: 'gen_ai.response.finish_reasons',
  RESPONSE_ID: 'gen_ai.response.id',

  // Content (for logging prompt/completion)
  PROMPT: 'gen_ai.prompt',
  COMPLETION: 'gen_ai.completion',

  // Tool use
  TOOL_NAME: 'gen_ai.tool.name',
  TOOL_CALL_ID: 'gen_ai.tool.call_id',

  // Nexus-specific extensions
  NEXUS_AGENT_ID: 'nexus.agent.id',
  NEXUS_AGENT_NAME: 'nexus.agent.name',
  NEXUS_WORKSPACE_ID: 'nexus.workspace.id',
  NEXUS_ORACLE_MODE: 'nexus.oracle.mode',
  NEXUS_COST_USD: 'nexus.cost.usd',
  NEXUS_GUARDRAIL_TRIGGERED: 'nexus.guardrail.triggered',
  NEXUS_RAG_CHUNKS_USED: 'nexus.rag.chunks_used',
  NEXUS_CONTEXT_TIER: 'nexus.context.tier',      // L0, L1, L2
  NEXUS_SKILL_USED: 'nexus.skill.used',          // Self-evolution skill
} as const;

// Create a span-compatible attributes object for LLM calls
export function createGenAIAttributes(params: {
  system: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  temperature?: number;
  finishReason?: string;
  agentId?: string;
  agentName?: string;
  costUsd?: number;
}): Record<string, string | number | boolean> {
  const attrs: Record<string, string | number | boolean> = {
    [GEN_AI.SYSTEM]: params.system,
    [GEN_AI.REQUEST_MODEL]: params.model,
  };

  if (params.inputTokens !== undefined) attrs[GEN_AI.USAGE_INPUT_TOKENS] = params.inputTokens;
  if (params.outputTokens !== undefined) attrs[GEN_AI.USAGE_OUTPUT_TOKENS] = params.outputTokens;
  if (params.inputTokens && params.outputTokens) attrs[GEN_AI.USAGE_TOTAL_TOKENS] = params.inputTokens + params.outputTokens;
  if (params.temperature !== undefined) attrs[GEN_AI.REQUEST_TEMPERATURE] = params.temperature;
  if (params.finishReason) attrs[GEN_AI.RESPONSE_FINISH_REASON] = params.finishReason;
  if (params.agentId) attrs[GEN_AI.NEXUS_AGENT_ID] = params.agentId;
  if (params.agentName) attrs[GEN_AI.NEXUS_AGENT_NAME] = params.agentName;
  if (params.costUsd !== undefined) attrs[GEN_AI.NEXUS_COST_USD] = params.costUsd;

  return attrs;
}

// Cost calculator for major providers
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
    'claude-opus-4-6': { input: 15, output: 75 },
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gemini-2.5-pro': { input: 1.25, output: 10 },
    'gemini-2.5-flash': { input: 0.075, output: 0.3 },
    'deepseek-chat': { input: 0.14, output: 0.28 },
  };

  const normalizedModel = Object.keys(pricing).find(k => model.includes(k)) || '';
  const price = pricing[normalizedModel] || { input: 1, output: 3 };

  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
