/**
 * Nexus Agents Studio — Cost Calculator Service
 *
 * Tracks and estimates costs for LLM usage across all providers.
 * Features:
 * - Pre-execution cost estimation
 * - Post-execution actual cost tracking
 * - Per-node cost breakdown in workflows
 * - Budget alerts and limits
 * - Provider/model pricing database
 * - BRL conversion support
 */


import type { ModelPricing, CostEstimate, CostBreakdownItem, ActualCost, BudgetConfig, BudgetStatus } from './types/costCalculatorTypes';
import { PRICING_DB } from './presets/costPricingPresets';

export type { ModelPricing, CostEstimate, CostBreakdownItem, ActualCost, BudgetConfig, BudgetStatus } from './types/costCalculatorTypes';
export interface ModelPricing {
  provider: string;
  model: string;
  inputPricePerMToken: number;   // USD per 1M input tokens
  outputPricePerMToken: number;  // USD per 1M output tokens
  cachePricePerMToken?: number;  // USD per 1M cached tokens (if supported)
  imagePricePerUnit?: number;    // USD per image
  audioPricePerMinute?: number;  // USD per minute of audio
  lastUpdated: string;
}

export interface CostEstimate {
  provider: string;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  totalCostBrl: number;
  confidence: 'low' | 'medium' | 'high';
  breakdown?: CostBreakdownItem[];
}

export interface CostBreakdownItem {
  label: string;
  nodeId?: string;
  nodeType?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  provider: string;
  model: string;
}

export interface ActualCost {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  totalCostBrl: number;
  durationMs: number;
  provider: string;
  model: string;
  timestamp: string;
}

export interface BudgetConfig {
  maxCostPerRequestUsd: number;
  maxCostPerDayUsd: number;
  maxCostPerMonthUsd: number;
  alertThresholdPercent: number;  // Alert when usage exceeds this % of budget
}

export interface BudgetStatus {
  dailySpentUsd: number;
  monthlySpentUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  dailyPercent: number;
  monthlyPercent: number;
  isOverDailyBudget: boolean;
  isOverMonthlyBudget: boolean;
  shouldAlert: boolean;
}

// ──────── Pricing Database (updated April 2026) ────────

const PRICING_DB: ModelPricing[] = [
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

// BRL exchange rate (approximate, updated periodically)
let USD_TO_BRL = 5.75;

// ──────── Core Functions ────────

/**
 * Get pricing for a specific model
 */
export function getModelPricing(provider: string, model: string): ModelPricing | null {
  // Exact match first
  const exact = PRICING_DB.find(
    (p) => p.provider === provider.toLowerCase() && p.model === model.toLowerCase()
  );
  if (exact) return exact;

  // Partial match (model name contains)
  const partial = PRICING_DB.find(
    (p) => p.provider === provider.toLowerCase() && model.toLowerCase().includes(p.model.toLowerCase())
  );
  return partial ?? null;
}

/**
 * Get all available pricing entries
 */
export function getAllPricing(): ModelPricing[] {
  return [...PRICING_DB];
}

/**
 * Update the USD→BRL exchange rate
 */
export function setExchangeRate(rate: number): void {
  USD_TO_BRL = rate;
}

/**
 * Get current exchange rate
 */
export function getExchangeRate(): number {
  return USD_TO_BRL;
}

/**
 * Calculate cost for a given token count
 */
export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): ActualCost {
  if (inputTokens < 0 || outputTokens < 0) {
    throw new Error('Token counts must be non-negative');
  }
  if (!provider || !model) {
    throw new Error('Provider and model are required');
  }
  const pricing = getModelPricing(provider, model);
  const inputRate = pricing?.inputPricePerMToken ?? 3.0;  // default to Sonnet-range
  const outputRate = pricing?.outputPricePerMToken ?? 15.0;

  const inputCostUsd = (inputTokens / 1_000_000) * inputRate;
  const outputCostUsd = (outputTokens / 1_000_000) * outputRate;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    totalCostBrl: totalCostUsd * USD_TO_BRL,
    durationMs: 0,
    provider,
    model,
    timestamp: new Date().toISOString(),
  };
}

// ──────── Pre-Execution Estimation ────────

/**
 * Estimate cost BEFORE executing a workflow.
 * Analyzes nodes and estimates token usage per node.
 */
export function estimateWorkflowCost(
  nodes: Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
  }>,
  defaultProvider: string,
  defaultModel: string
): CostEstimate {
  const breakdown: CostBreakdownItem[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (const node of nodes) {
    const nodeProvider = (node.data.provider as string) ?? defaultProvider;
    const nodeModel = (node.data.model as string) ?? defaultModel;
    const nodeType = node.type;

    // Estimate tokens based on node type
    const estimate = estimateNodeTokens(nodeType, node.data);
    totalInput += estimate.input;
    totalOutput += estimate.output;

    const cost = calculateCost(nodeProvider, nodeModel, estimate.input, estimate.output);

    breakdown.push({
      label: (node.data.name as string) ?? nodeType,
      nodeId: node.id,
      nodeType,
      inputTokens: estimate.input,
      outputTokens: estimate.output,
      costUsd: cost.totalCostUsd,
      provider: nodeProvider,
      model: nodeModel,
    });
  }

  const total = calculateCost(defaultProvider, defaultModel, totalInput, totalOutput);

  return {
    provider: defaultProvider,
    model: defaultModel,
    estimatedInputTokens: totalInput,
    estimatedOutputTokens: totalOutput,
    inputCostUsd: total.inputCostUsd,
    outputCostUsd: total.outputCostUsd,
    totalCostUsd: total.totalCostUsd,
    totalCostBrl: total.totalCostBrl,
    confidence: nodes.length > 10 ? 'low' : nodes.length > 3 ? 'medium' : 'high',
    breakdown,
  };
}

/**
 * Estimate tokens for a single node based on its type
 */
function estimateNodeTokens(
  nodeType: string,
  nodeData: Record<string, unknown>
): { input: number; output: number } {
  // Base estimates per node type (averages from production data)
  const estimates: Record<string, { input: number; output: number }> = {
    'llm': { input: 2000, output: 1000 },
    'llm-call': { input: 2000, output: 1000 },
    'rag-search': { input: 1500, output: 500 },
    'tool-call': { input: 500, output: 200 },
    'condition': { input: 200, output: 50 },
    'transform': { input: 300, output: 300 },
    'input': { input: 100, output: 0 },
    'output': { input: 0, output: 100 },
    'webhook': { input: 200, output: 200 },
    'code': { input: 1000, output: 500 },
    'oracle': { input: 8000, output: 4000 },  // Multi-LLM uses more
    'guardrails': { input: 500, output: 100 },
    'memory': { input: 300, output: 100 },
    'handoff': { input: 1000, output: 200 },
  };

  const base = estimates[nodeType] ?? { input: 500, output: 300 };

  // Adjust based on node data hints
  const maxTokens = Number(nodeData.max_tokens ?? 0);
  if (maxTokens > 0) {
    return { input: base.input, output: Math.min(maxTokens, base.output * 3) };
  }

  // If system prompt is long, increase input estimate
  const systemPrompt = String(nodeData.system_prompt ?? '');
  if (systemPrompt.length > 500) {
    const extraTokens = Math.floor(systemPrompt.length / 4);
    return { input: base.input + extraTokens, output: base.output };
  }

  return base;
}

// ──────── Budget Management ────────

const DEFAULT_BUDGET: BudgetConfig = {
  maxCostPerRequestUsd: 1.0,
  maxCostPerDayUsd: 50.0,
  maxCostPerMonthUsd: 500.0,
  alertThresholdPercent: 80,
};

let currentBudget: BudgetConfig = { ...DEFAULT_BUDGET };

/**
 * Set budget configuration
 */
export function setBudget(budget: Partial<BudgetConfig>): BudgetConfig {
  currentBudget = { ...currentBudget, ...budget };
  return currentBudget;
}

/**
 * Get current budget configuration
 */
export function getBudget(): BudgetConfig {
  return { ...currentBudget };
}

/**
 * Check if a cost would exceed the per-request budget
 */
export function checkRequestBudget(estimatedCostUsd: number): {
  allowed: boolean;
  maxAllowed: number;
  estimated: number;
  overage: number;
} {
  const allowed = estimatedCostUsd <= currentBudget.maxCostPerRequestUsd;
  return {
    allowed,
    maxAllowed: currentBudget.maxCostPerRequestUsd,
    estimated: estimatedCostUsd,
    overage: allowed ? 0 : estimatedCostUsd - currentBudget.maxCostPerRequestUsd,
  };
}

/**
 * Calculate budget status from spending data
 */
export function calculateBudgetStatus(
  dailySpentUsd: number,
  monthlySpentUsd: number
): BudgetStatus {
  const dailyPercent = (dailySpentUsd / currentBudget.maxCostPerDayUsd) * 100;
  const monthlyPercent = (monthlySpentUsd / currentBudget.maxCostPerMonthUsd) * 100;

  return {
    dailySpentUsd,
    monthlySpentUsd,
    dailyBudgetUsd: currentBudget.maxCostPerDayUsd,
    monthlyBudgetUsd: currentBudget.maxCostPerMonthUsd,
    dailyPercent,
    monthlyPercent,
    isOverDailyBudget: dailySpentUsd > currentBudget.maxCostPerDayUsd,
    isOverMonthlyBudget: monthlySpentUsd > currentBudget.maxCostPerMonthUsd,
    shouldAlert:
      dailyPercent >= currentBudget.alertThresholdPercent ||
      monthlyPercent >= currentBudget.alertThresholdPercent,
  };
}

// ──────── Formatting Helpers ────────

/**
 * Format cost for display (with currency)
 */
export function formatCostUsd(usd: number): string {
  if (usd < 0.001) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format cost in BRL
 */
export function formatCostBrl(usd: number): string {
  const brl = usd * USD_TO_BRL;
  if (brl < 0.01) return 'R$ 0,00';
  return `R$ ${brl.toFixed(2).replace('.', ',')}`;
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

/**
 * Get a cost comparison across providers for the same token count
 */
export function compareCosts(
  inputTokens: number,
  outputTokens: number
): Array<{
  provider: string;
  model: string;
  costUsd: number;
  costBrl: number;
}> {
  return PRICING_DB.map((pricing) => {
    const cost = calculateCost(pricing.provider, pricing.model, inputTokens, outputTokens);
    return {
      provider: pricing.provider,
      model: pricing.model,
      costUsd: cost.totalCostUsd,
      costBrl: cost.totalCostBrl,
    };
  }).sort((a, b) => a.costUsd - b.costUsd);
}
