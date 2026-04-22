/**
 * Thinking Budget — `src/lib/thinkingBudget.ts`
 *
 * Controla o **reasoning budget** (extended thinking) dos modelos que
 * suportam (Claude Sonnet 4.6+ com `thinking: { budget_tokens }`,
 * OpenAI o-series com `reasoning.effort`, Gemini com `thinking_mode`).
 *
 * Abstração única: o caller declara `effort: 'off' | 'low' | 'medium' | 'high'`
 * e o helper traduz para o formato certo do provider + calcula o custo
 * estimado adicional.
 */

export type ThinkingEffort = 'off' | 'low' | 'medium' | 'high';

/** Budget tokens por nível — valores padrão recomendados (Anthropic). */
export const THINKING_BUDGETS: Record<ThinkingEffort, number> = {
  off: 0,
  low: 1024,
  medium: 4096,
  high: 16_384,
};

export interface AnthropicThinkingConfig {
  type: 'enabled';
  budget_tokens: number;
}

export interface OpenAIReasoningConfig {
  effort: 'low' | 'medium' | 'high';
}

export interface GeminiThinkingConfig {
  thinking_budget: number;
}

export interface ThinkingProviderConfig {
  anthropic?: AnthropicThinkingConfig;
  openai?: OpenAIReasoningConfig;
  gemini?: GeminiThinkingConfig;
}

export interface ResolveThinkingInput {
  effort: ThinkingEffort;
  /** Permite override explícito do budget em tokens. */
  budget_tokens_override?: number;
}

export function resolveThinkingConfig(input: ResolveThinkingInput): ThinkingProviderConfig {
  const budget = input.budget_tokens_override ?? THINKING_BUDGETS[input.effort];
  if (budget <= 0 || input.effort === 'off') return {};
  return {
    anthropic: { type: 'enabled', budget_tokens: budget },
    openai: {
      effort: input.effort === 'low' ? 'low' : input.effort === 'medium' ? 'medium' : 'high',
    },
    gemini: { thinking_budget: budget },
  };
}

/**
 * Estimativa de custo adicional do reasoning.
 * Tokens de thinking são contados como output tokens pela maioria dos
 * providers — a fórmula usa o `output_price_per_mtok` do modelo.
 */
export function estimateThinkingCost(
  effort: ThinkingEffort,
  output_price_per_mtok: number,
): number {
  const budget = THINKING_BUDGETS[effort];
  return (budget / 1_000_000) * output_price_per_mtok;
}

/** Tradução de `effort` para linguagem humana na UI. */
export function describeThinking(effort: ThinkingEffort): string {
  const budget = THINKING_BUDGETS[effort];
  if (budget === 0) return 'Desligado';
  return `${effort} — ${budget.toLocaleString('pt-BR')} tokens de raciocínio`;
}
