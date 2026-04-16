import { useMemo } from 'react';
import { getModelPrice, estimateTokens, USD_TO_BRL, type ModelPrice } from '@/lib/llmPricing';

export interface CostEstimateInput {
  model?: string | null;
  systemPrompt?: string;
  userInput?: string;
  maxTokens?: number;
  toolsCount?: number;
}

export interface CostEstimateResult {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costBrl: number;
  estLatencyMs: number;
  pricing: ModelPrice;
}

/**
 * Estimate cost & latency for a single LLM call.
 * Token math: chars/4 for input; maxTokens for output ceiling.
 */
export function useCostEstimate(input: CostEstimateInput): CostEstimateResult {
  return useMemo(() => {
    const pricing = getModelPrice(input.model);
    const sysTokens = estimateTokens(input.systemPrompt ?? '');
    const userTokens = estimateTokens(input.userInput ?? '');
    // Each tool definition adds ~50 tokens of schema overhead.
    const toolsOverhead = (input.toolsCount ?? 0) * 50;
    const inputTokens = sysTokens + userTokens + toolsOverhead;
    // Assume model uses ~60% of max_tokens on average; floor 100 for short replies.
    const outputTokens = Math.max(100, Math.floor((input.maxTokens ?? 1000) * 0.6));

    const inputCost = (inputTokens / 1000) * pricing.input_per_1k;
    const outputCost = (outputTokens / 1000) * pricing.output_per_1k;
    const costUsd = inputCost + outputCost;

    // Latency scales slightly with output size.
    const estLatencyMs = pricing.avg_latency_ms + Math.floor(outputTokens / 50) * 10;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      costBrl: costUsd * USD_TO_BRL,
      estLatencyMs,
      pricing,
    };
  }, [input.model, input.systemPrompt, input.userInput, input.maxTokens, input.toolsCount]);
}
