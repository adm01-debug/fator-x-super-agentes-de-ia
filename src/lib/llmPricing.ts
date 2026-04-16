/**
 * LLM Pricing Table — USD per 1K tokens.
 * Last updated: April 2026.
 */

export interface ModelPrice {
  model: string;
  label: string;
  provider: 'google' | 'openai' | 'anthropic';
  input_per_1k: number;
  output_per_1k: number;
  avg_latency_ms: number;
  context_window: number;
}

export const LLM_PRICING: Record<string, ModelPrice> = {
  // Google Gemini
  'google/gemini-2.5-flash': {
    model: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google',
    input_per_1k: 0.00015, output_per_1k: 0.0006, avg_latency_ms: 800, context_window: 1_000_000,
  },
  'google/gemini-2.5-flash-lite': {
    model: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'google',
    input_per_1k: 0.00010, output_per_1k: 0.0004, avg_latency_ms: 500, context_window: 1_000_000,
  },
  'google/gemini-2.5-pro': {
    model: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google',
    input_per_1k: 0.00125, output_per_1k: 0.010, avg_latency_ms: 2200, context_window: 2_000_000,
  },
  'google/gemini-3-flash-preview': {
    model: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'google',
    input_per_1k: 0.00020, output_per_1k: 0.0008, avg_latency_ms: 700, context_window: 1_000_000,
  },
  'google/gemini-3.1-pro-preview': {
    model: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'google',
    input_per_1k: 0.00150, output_per_1k: 0.012, avg_latency_ms: 2400, context_window: 2_000_000,
  },
  // OpenAI
  'openai/gpt-5': {
    model: 'openai/gpt-5', label: 'GPT-5', provider: 'openai',
    input_per_1k: 0.00250, output_per_1k: 0.0100, avg_latency_ms: 2800, context_window: 400_000,
  },
  'openai/gpt-5-mini': {
    model: 'openai/gpt-5-mini', label: 'GPT-5 Mini', provider: 'openai',
    input_per_1k: 0.00050, output_per_1k: 0.0020, avg_latency_ms: 1200, context_window: 200_000,
  },
  'openai/gpt-5-nano': {
    model: 'openai/gpt-5-nano', label: 'GPT-5 Nano', provider: 'openai',
    input_per_1k: 0.00015, output_per_1k: 0.0006, avg_latency_ms: 600, context_window: 128_000,
  },
  'openai/gpt-5.2': {
    model: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'openai',
    input_per_1k: 0.00280, output_per_1k: 0.0120, avg_latency_ms: 3000, context_window: 400_000,
  },
};

export const USD_TO_BRL = 5.0;

export function getModelPrice(modelId: string | undefined | null): ModelPrice {
  if (modelId && LLM_PRICING[modelId]) return LLM_PRICING[modelId];
  return LLM_PRICING['google/gemini-2.5-flash'];
}

export function listModelPrices(): ModelPrice[] {
  return Object.values(LLM_PRICING);
}

/** Rough char→token estimation (avg ~4 chars/token for EN/PT). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
