import type { ModelPricing } from '../types/costCalculatorTypes';

export const PRICING_DB: ModelPricing[] = [
  // Anthropic
  { provider: 'anthropic', model: 'claude-opus-4-6', inputPricePerMToken: 15.0, outputPricePerMToken: 75.0, lastUpdated: '2026-04-01' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', inputPricePerMToken: 3.0, outputPricePerMToken: 15.0, lastUpdated: '2026-04-01' },
  { provider: 'anthropic', model: 'claude-haiku-4-5', inputPricePerMToken: 0.8, outputPricePerMToken: 4.0, lastUpdated: '2026-04-01' },
  // OpenAI
  { provider: 'openai', model: 'gpt-4o', inputPricePerMToken: 2.5, outputPricePerMToken: 10.0, lastUpdated: '2026-04-01' },
  { provider: 'openai', model: 'gpt-4o-mini', inputPricePerMToken: 0.15, outputPricePerMToken: 0.6, lastUpdated: '2026-04-01' },
  { provider: 'openai', model: 'gpt-4.1', inputPricePerMToken: 2.0, outputPricePerMToken: 8.0, lastUpdated: '2026-04-01' },
  { provider: 'openai', model: 'gpt-4.1-mini', inputPricePerMToken: 0.4, outputPricePerMToken: 1.6, lastUpdated: '2026-04-01' },
  { provider: 'openai', model: 'o3-mini', inputPricePerMToken: 1.1, outputPricePerMToken: 4.4, lastUpdated: '2026-04-01' },
  // Google
  { provider: 'google', model: 'gemini-2.5-pro', inputPricePerMToken: 1.25, outputPricePerMToken: 10.0, lastUpdated: '2026-04-01' },
  { provider: 'google', model: 'gemini-2.5-flash', inputPricePerMToken: 0.15, outputPricePerMToken: 0.6, lastUpdated: '2026-04-01' },
  { provider: 'google', model: 'gemini-2.0-flash', inputPricePerMToken: 0.1, outputPricePerMToken: 0.4, lastUpdated: '2026-04-01' },
  // DeepSeek
  { provider: 'deepseek', model: 'deepseek-v3', inputPricePerMToken: 0.27, outputPricePerMToken: 1.1, lastUpdated: '2026-04-01' },
  { provider: 'deepseek', model: 'deepseek-r1', inputPricePerMToken: 0.55, outputPricePerMToken: 2.19, lastUpdated: '2026-04-01' },
  // Meta (via OpenRouter)
  { provider: 'meta', model: 'llama-4-maverick', inputPricePerMToken: 0.2, outputPricePerMToken: 0.6, lastUpdated: '2026-04-01' },
  { provider: 'meta', model: 'llama-4-scout', inputPricePerMToken: 0.15, outputPricePerMToken: 0.4, lastUpdated: '2026-04-01' },
  // Mistral
  { provider: 'mistral', model: 'mistral-large', inputPricePerMToken: 2.0, outputPricePerMToken: 6.0, lastUpdated: '2026-04-01' },
  { provider: 'mistral', model: 'mistral-small', inputPricePerMToken: 0.1, outputPricePerMToken: 0.3, lastUpdated: '2026-04-01' },
  // Qwen
  { provider: 'alibaba', model: 'qwen-3', inputPricePerMToken: 0.3, outputPricePerMToken: 1.2, lastUpdated: '2026-04-01' },
  // HuggingFace (free tier)
  { provider: 'huggingface', model: 'inference-free', inputPricePerMToken: 0, outputPricePerMToken: 0, lastUpdated: '2026-04-01' },
];
