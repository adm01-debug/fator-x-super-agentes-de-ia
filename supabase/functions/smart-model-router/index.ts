import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const VERSION = "v1.2";

interface ModelInfo {
  model: string;
  provider: string;
  tier: string;
  input_cost: number;
  output_cost: number;
  context_window: number;
  capabilities: string[];
}

const MODELS: ModelInfo[] = [
  { model: "youtu-llm-1.96b", provider: "huggingface", tier: "nano", input_cost: 0.005, output_cost: 0.01, context_window: 128000, capabilities: ["agentic", "routing"] },
  { model: "nemotron-3-nano-30b-a3b", provider: "openrouter", tier: "fast", input_cost: 0.01, output_cost: 0.03, context_window: 1000000, capabilities: ["reasoning", "agentic", "tool_use"] },
  { model: "glm-4.7-flash", provider: "openrouter", tier: "fast", input_cost: 0.01, output_cost: 0.04, context_window: 128000, capabilities: ["reasoning", "coding", "agentic"] },
  { model: "claude-haiku-4-5-20251001", provider: "anthropic", tier: "fast", input_cost: 0.80, output_cost: 4.00, context_window: 200000, capabilities: ["reasoning", "coding", "agentic"] },
  { model: "qwen3-30b-a3b", provider: "openrouter", tier: "premium", input_cost: 0.03, output_cost: 0.12, context_window: 262144, capabilities: ["reasoning", "coding", "agentic"] },
  { model: "qwen3.5-397b-a17b", provider: "openrouter", tier: "flagship", input_cost: 0.15, output_cost: 0.60, context_window: 262144, capabilities: ["reasoning", "coding", "vision", "agentic"] },
  { model: "glm-5", provider: "openrouter", tier: "flagship", input_cost: 0.10, output_cost: 0.40, context_window: 128000, capabilities: ["reasoning", "coding", "agentic"] },
  { model: "claude-sonnet-4-20250514", provider: "anthropic", tier: "flagship", input_cost: 3.00, output_cost: 15.00, context_window: 200000, capabilities: ["reasoning", "coding", "vision", "agentic"] },
];

function analyzeComplexity(query: string): { level: string; score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Length factor
  if (query.length > 2000) { score += 0.2; factors.push("long_input"); }
  else if (query.length > 500) { score += 0.1; factors.push("medium_input"); }

  // Code indicators
  if (/```|function\s|class\s|import\s|const\s|def\s|async\s/i.test(query)) { score += 0.3; factors.push("code_content"); }

  // Reasoning indicators
  if (/analise|compare|explique.*diferença|por que|raciocin|step.by.step|chain.of.thought/i.test(query)) { score += 0.25; factors.push("reasoning_required"); }

  // Multi-step
  if (/primeiro.*depois|etapa|passo|1\).*2\)|step\s*\d/i.test(query)) { score += 0.2; factors.push("multi_step"); }

  // Vision
  if (/imagem|foto|screenshot|visual|olhe|veja.*imagem/i.test(query)) { score += 0.15; factors.push("vision_needed"); }

  score = Math.min(score, 1);
  const level = score < 0.2 ? "simple" : score < 0.5 ? "moderate" : score < 0.75 ? "complex" : "expert";

  return { level, score, factors };
}

function selectModel(complexity: { level: string; score: number; factors: string[] }, preferredProvider?: string): { recommended: ModelInfo; alternatives: ModelInfo[] } {
  let candidates = [...MODELS];

  // Filter by provider preference
  if (preferredProvider) {
    const providerModels = candidates.filter(m => m.provider === preferredProvider);
    if (providerModels.length > 0) candidates = providerModels;
  }

  // Select tier based on complexity
  let targetTier: string;
  if (complexity.score < 0.2) targetTier = "nano";
  else if (complexity.score < 0.4) targetTier = "fast";
  else if (complexity.score < 0.7) targetTier = "premium";
  else targetTier = "flagship";

  // Need vision?
  const needsVision = complexity.factors.includes("vision_needed");
  if (needsVision) {
    candidates = candidates.filter(m => m.capabilities.includes("vision"));
    targetTier = "flagship"; // Vision requires flagship
  }

  // Get tier matches, fallback to next tier up
  const tiers = ["nano", "fast", "premium", "flagship"];
  const tierIdx = tiers.indexOf(targetTier);
  let selected = candidates.filter(m => m.tier === targetTier);
  if (selected.length === 0 && tierIdx < tiers.length - 1) {
    selected = candidates.filter(m => m.tier === tiers[tierIdx + 1]);
  }
  if (selected.length === 0) selected = candidates;

  // Sort by cost
  selected.sort((a, b) => a.input_cost - b.input_cost);

  const recommended = selected[0];
  const alternatives = candidates.filter(m => m.model !== recommended.model).slice(0, 3);

  return { recommended, alternatives };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ service: "smart-model-router", version: VERSION, models: MODELS.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { query, preferred_provider } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const complexity = analyzeComplexity(query);
    const { recommended, alternatives } = selectModel(complexity, preferred_provider);

    // Estimate cost for ~500 tokens in, ~1000 tokens out
    const estimatedCost = (recommended.input_cost * 500 + recommended.output_cost * 1000) / 1000000;

    return new Response(JSON.stringify({
      recommended_model: recommended.model,
      tier: recommended.tier,
      estimated_cost_per_query: estimatedCost,
      complexity,
      alternatives: alternatives.map(a => ({
        model: a.model,
        tier: a.tier,
        cost: (a.input_cost * 500 + a.output_cost * 1000) / 1000000,
      })),
      version: VERSION,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
