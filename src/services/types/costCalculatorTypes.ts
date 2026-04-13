/**
 * Types for Cost Calculator Service
 */

export interface ModelPricing {
  provider: string;
  model: string;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  cachePricePerMToken?: number;
  imagePricePerUnit?: number;
  audioPricePerMinute?: number;
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
  alertThresholdPercent: number;
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
