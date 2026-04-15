/**
 * Nexus — Smart Model Router Service
 * Routes queries to optimal LLM based on complexity, cost, and capability.
 *
 * Has a local heuristic fallback if the smart-model-router Edge Function
 * is unavailable, so the app never breaks when routing fails.
 */
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export interface RouteResult {
  recommended_model: string;
  tier: string;
  estimated_cost_per_query: number;
  complexity: { level: string; score: number; factors: string[] };
  alternatives: Array<{ model: string; tier: string; cost: number }>;
}

/**
 * Route a query to the optimal model. Tries the smart-model-router
 * Edge Function first; falls back to local heuristic on failure.
 */
export async function routeQuery(query: string, preferredProvider?: string): Promise<RouteResult> {
  try {
    const { data, error } = await supabase.functions.invoke('smart-model-router', {
      body: { query, preferred_provider: preferredProvider },
    });
    if (error) throw error;
    return data as RouteResult;
  } catch (e) {
    logger.warn('smart-model-router unavailable, using local heuristic', {
      error: e instanceof Error ? e.message : String(e),
    });
    return routeLocally(query, preferredProvider);
  }
}

// ──────── Local Heuristic Router ────────

const MODEL_TIERS = [
  { model: 'claude-haiku-4-5-20251001', tier: 'fast', costPer1k: 0.00025, maxComplexity: 0.3 },
  { model: 'claude-sonnet-4-6', tier: 'balanced', costPer1k: 0.003, maxComplexity: 0.7 },
  { model: 'claude-opus-4-6', tier: 'premium', costPer1k: 0.015, maxComplexity: 1.0 },
];

function estimateComplexity(query: string): { level: string; score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Length-based
  if (query.length > 2000) {
    score += 0.2;
    factors.push('long_input');
  } else if (query.length > 500) {
    score += 0.1;
    factors.push('medium_input');
  }

  // Code/technical keywords
  const codePatterns = /```|function\s|class\s|import\s|SELECT\s|CREATE\s|def\s/i;
  if (codePatterns.test(query)) {
    score += 0.25;
    factors.push('code_content');
  }

  // Multi-step reasoning keywords
  const reasoningPatterns = /analise|compare|avalie|explique.*por que|step.by.step|passo a passo/i;
  if (reasoningPatterns.test(query)) {
    score += 0.2;
    factors.push('reasoning_required');
  }

  // Math/data keywords
  const mathPatterns = /calcul|formula|equa[çc][ãa]o|percentual|estat[ií]stica/i;
  if (mathPatterns.test(query)) {
    score += 0.15;
    factors.push('mathematical');
  }

  // Multi-language
  const multiLangPatterns = /traduz|translate|em ingl[eê]s|in english|em portugu[eê]s/i;
  if (multiLangPatterns.test(query)) {
    score += 0.1;
    factors.push('multilingual');
  }

  score = Math.min(1, score);
  const level = score > 0.6 ? 'high' : score > 0.3 ? 'medium' : 'low';
  return { level, score, factors };
}

function routeLocally(query: string, preferredProvider?: string): RouteResult {
  const complexity = estimateComplexity(query);

  // Find the cheapest model that can handle this complexity
  const suitable = MODEL_TIERS.filter((m) => complexity.score <= m.maxComplexity);
  const selected = suitable[0] || MODEL_TIERS[MODEL_TIERS.length - 1];

  // If user prefers a provider, try to match
  if (preferredProvider) {
    const preferred = MODEL_TIERS.find(
      (m) => m.model.includes(preferredProvider) && complexity.score <= m.maxComplexity,
    );
    if (preferred) {
      return {
        recommended_model: preferred.model,
        tier: preferred.tier,
        estimated_cost_per_query: preferred.costPer1k * (query.length / 4000),
        complexity,
        alternatives: MODEL_TIERS.filter((m) => m.model !== preferred.model).map((m) => ({
          model: m.model,
          tier: m.tier,
          cost: m.costPer1k * (query.length / 4000),
        })),
      };
    }
  }

  return {
    recommended_model: selected.model,
    tier: selected.tier,
    estimated_cost_per_query: selected.costPer1k * (query.length / 4000),
    complexity,
    alternatives: MODEL_TIERS.filter((m) => m.model !== selected.model).map((m) => ({
      model: m.model,
      tier: m.tier,
      cost: m.costPer1k * (query.length / 4000),
    })),
  };
}
