/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Smart Model Router
 * ═══════════════════════════════════════════════════════════════
 * Routes a query to the optimal LLM tier based on:
 *  - Token complexity
 *  - Required reasoning depth
 *  - Estimated cost vs budget
 *  - Preferred provider
 *
 * Tiers (cheapest → most powerful):
 *   nano    → Haiku 4.5 / GPT-4o-mini / Gemini Flash
 *   small   → Sonnet 4.6 / GPT-4o
 *   large   → Opus 4.6 / GPT-5 / Gemini 2.5 Pro
 *
 * Used by: src/services/modelRouterService.ts
 * Pattern: complexity scoring + cost-aware routing
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

// ═══ Input Schema ═══
const RouteInput = z.object({
  query: z.string().min(1).max(20_000),
  preferred_provider: z.enum(['anthropic', 'openai', 'google', 'openrouter', 'auto']).optional().default('auto'),
  budget_tier: z.enum(['economy', 'balanced', 'premium']).optional().default('balanced'),
  task_hint: z.enum(['chat', 'code', 'reasoning', 'extraction', 'creative']).optional(),
});

// ═══ Model Catalog (per-1k token costs in USD) ═══
type ModelInfo = {
  id: string;
  tier: 'nano' | 'small' | 'large';
  provider: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  context_window: number;
  strengths: string[];
};

const MODELS: ModelInfo[] = [
  // NANO tier — high volume, low cost
  { id: 'claude-haiku-4-5-20251001',     tier: 'nano',  provider: 'anthropic',  input_cost_per_1k: 0.0008, output_cost_per_1k: 0.004, context_window: 200_000, strengths: ['chat', 'extraction', 'classification'] },
  { id: 'gpt-4o-mini',                   tier: 'nano',  provider: 'openai',     input_cost_per_1k: 0.00015, output_cost_per_1k: 0.0006, context_window: 128_000, strengths: ['chat', 'extraction'] },
  { id: 'gemini-2.0-flash',              tier: 'nano',  provider: 'google',     input_cost_per_1k: 0.000075, output_cost_per_1k: 0.0003, context_window: 1_000_000, strengths: ['chat', 'long_context'] },
  // SMALL tier — workhorse
  { id: 'claude-sonnet-4-6',             tier: 'small', provider: 'anthropic',  input_cost_per_1k: 0.003, output_cost_per_1k: 0.015, context_window: 200_000, strengths: ['chat', 'code', 'reasoning', 'extraction'] },
  { id: 'gpt-4o',                        tier: 'small', provider: 'openai',     input_cost_per_1k: 0.0025, output_cost_per_1k: 0.01, context_window: 128_000, strengths: ['chat', 'code'] },
  // LARGE tier — top reasoning
  { id: 'claude-opus-4-6',               tier: 'large', provider: 'anthropic',  input_cost_per_1k: 0.015, output_cost_per_1k: 0.075, context_window: 200_000, strengths: ['reasoning', 'code', 'creative'] },
  { id: 'gemini-2.5-pro',                tier: 'large', provider: 'google',     input_cost_per_1k: 0.00125, output_cost_per_1k: 0.005, context_window: 2_000_000, strengths: ['reasoning', 'long_context'] },
];

// ═══ Complexity Analyzer ═══
type Complexity = { level: 'low' | 'medium' | 'high'; score: number; factors: string[] };

function analyzeComplexity(query: string, taskHint?: string): Complexity {
  const factors: string[] = [];
  let score = 0;

  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount > 200) { score += 3; factors.push('long_query'); }
  else if (wordCount > 50) { score += 1; factors.push('medium_query'); }

  const reasoningKeywords = /\b(why|because|reason|analyze|compare|evaluate|por que|porque|análise|comparar|avaliar|raciocin|deduzir|inferir)\b/i;
  if (reasoningKeywords.test(query)) { score += 2; factors.push('reasoning_required'); }

  const codeKeywords = /\b(function|class|def|var|const|let|return|import|SELECT|INSERT|UPDATE|DELETE)\b/;
  if (codeKeywords.test(query) || query.includes('```')) { score += 2; factors.push('code_present'); }

  const multiStep = /\b(step|first|then|after|next|finally|primeiro|depois|então|por fim)\b/i;
  if (multiStep.test(query)) { score += 1; factors.push('multi_step'); }

  const mathHeavy = /[\d+\-*/=<>≤≥∑∫]{3,}/;
  if (mathHeavy.test(query)) { score += 2; factors.push('math_heavy'); }

  if (taskHint === 'reasoning' || taskHint === 'code') { score += 2; factors.push(`hint_${taskHint}`); }
  if (taskHint === 'creative') { score += 1; factors.push('hint_creative'); }
  if (taskHint === 'chat' || taskHint === 'extraction') { score = Math.max(0, score - 1); factors.push(`hint_${taskHint}`); }

  let level: Complexity['level'];
  if (score <= 1) level = 'low';
  else if (score <= 4) level = 'medium';
  else level = 'high';

  return { level, score, factors };
}

// ═══ Routing Logic ═══
function pickModel(
  complexity: Complexity,
  preferredProvider: string,
  budgetTier: string
): { recommended: ModelInfo; alternatives: ModelInfo[] } {
  // Determine target tier from complexity and budget
  let targetTier: 'nano' | 'small' | 'large';
  if (budgetTier === 'economy') {
    targetTier = complexity.level === 'high' ? 'small' : 'nano';
  } else if (budgetTier === 'premium') {
    targetTier = complexity.level === 'low' ? 'small' : 'large';
  } else {
    // balanced
    if (complexity.level === 'low') targetTier = 'nano';
    else if (complexity.level === 'medium') targetTier = 'small';
    else targetTier = 'large';
  }

  // Filter models by target tier
  let candidates = MODELS.filter(m => m.tier === targetTier);

  // Apply provider preference
  if (preferredProvider !== 'auto') {
    const preferred = candidates.filter(m => m.provider === preferredProvider);
    if (preferred.length > 0) candidates = preferred;
  }

  // Sort by cost asc within tier
  candidates.sort((a, b) => a.input_cost_per_1k - b.input_cost_per_1k);
  const recommended = candidates[0] ?? MODELS[0];

  // Build alternatives: 1 from each tier
  const alternatives: ModelInfo[] = [];
  for (const tier of ['nano', 'small', 'large'] as const) {
    if (tier === recommended.tier) continue;
    const altList = MODELS.filter(m => m.tier === tier).sort((a, b) => a.input_cost_per_1k - b.input_cost_per_1k);
    if (altList[0]) alternatives.push(altList[0]);
  }

  return { recommended, alternatives };
}

function estimateCost(model: ModelInfo, queryTokens: number): number {
  // Assume avg response is ~500 tokens
  const expectedOutput = 500;
  return (queryTokens / 1000) * model.input_cost_per_1k + (expectedOutput / 1000) * model.output_cost_per_1k;
}

// ═══ Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    // Auth
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Rate limit
    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    // Validate
    const parsed = await parseBody(req, RouteInput);
    if (parsed.error) return parsed.error;
    const { query, preferred_provider, budget_tier, task_hint } = parsed.data;

    // Analyze
    const complexity = analyzeComplexity(query, task_hint);
    const { recommended, alternatives } = pickModel(complexity, preferred_provider, budget_tier);

    // Rough token count (~4 chars per token)
    const queryTokens = Math.ceil(query.length / 4);
    const estimatedCost = estimateCost(recommended, queryTokens);

    return jsonResponse(req, {
      recommended_model: recommended.id,
      tier: recommended.tier,
      provider: recommended.provider,
      estimated_cost_per_query: Number(estimatedCost.toFixed(6)),
      complexity,
      alternatives: alternatives.map(m => ({
        model: m.id,
        tier: m.tier,
        provider: m.provider,
        cost: Number(estimateCost(m, queryTokens).toFixed(6)),
      })),
      version: 'smart-model-router-v1.0',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(req, message, 500);
  }
});
