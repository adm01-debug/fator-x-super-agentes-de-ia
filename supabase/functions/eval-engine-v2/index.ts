import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const VERSION = "v1.0";

// RAGAS-inspired metrics computed locally
function computeFaithfulness(answer: string, contexts: string[]): number {
  if (!contexts.length || !answer) return 0;
  const allContext = contexts.join(" ").toLowerCase();
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return 0;
  const supported = sentences.filter(s => {
    const words = s.trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const found = words.filter(w => allContext.includes(w));
    return found.length / Math.max(words.length, 1) > 0.4;
  });
  return supported.length / sentences.length;
}

function computeAnswerRelevancy(query: string, answer: string): number {
  if (!query || !answer) return 0;
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const answerWords = answer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.size === 0) return 0.5;
  const overlap = answerWords.filter(w => queryWords.has(w)).length;
  return Math.min(overlap / queryWords.size, 1);
}

function computeContextPrecision(answer: string, contexts: string[]): number {
  if (!contexts.length) return 0;
  const answerWords = new Set(answer.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  let relevantContexts = 0;
  for (const ctx of contexts) {
    const ctxWords = ctx.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = ctxWords.filter(w => answerWords.has(w)).length;
    if (overlap / Math.max(ctxWords.length, 1) > 0.1) relevantContexts++;
  }
  return relevantContexts / contexts.length;
}

function computeContextRecall(answer: string, contexts: string[]): number {
  if (!answer || !contexts.length) return 0;
  const answerSentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (answerSentences.length === 0) return 0;
  const allContext = contexts.join(" ").toLowerCase();
  const covered = answerSentences.filter(s => {
    const words = s.trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return words.some(w => allContext.includes(w));
  });
  return covered.length / answerSentences.length;
}

function computeAnswerCorrectness(answer: string, expectedAnswer?: string): number {
  if (!expectedAnswer) return 0.5; // No ground truth, neutral score
  const aWords = new Set(answer.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const eWords = new Set(expectedAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (eWords.size === 0) return 0.5;
  const intersection = [...aWords].filter(w => eWords.has(w)).length;
  const precision = intersection / Math.max(aWords.size, 1);
  const recall = intersection / eWords.size;
  return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ service: "eval-engine-v2", version: VERSION, metrics: ["faithfulness", "answer_relevancy", "context_precision", "context_recall", "answer_correctness"] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  try {
    const { workspace_id, agent_id, test_cases, run_ragas = true } = await req.json();
    if (!test_cases || !Array.isArray(test_cases) || test_cases.length === 0) {
      return new Response(JSON.stringify({ error: "test_cases array is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scores = test_cases.map((tc: { query: string; answer: string; contexts: string[]; expected_answer?: string }) => {
      const faithfulness = computeFaithfulness(tc.answer, tc.contexts || []);
      const answer_relevancy = computeAnswerRelevancy(tc.query, tc.answer);
      const context_precision = computeContextPrecision(tc.answer, tc.contexts || []);
      const context_recall = computeContextRecall(tc.answer, tc.contexts || []);
      const answer_correctness = computeAnswerCorrectness(tc.answer, tc.expected_answer);
      const overall = (faithfulness + answer_relevancy + context_precision + context_recall + answer_correctness) / 5;

      return {
        query: tc.query,
        faithfulness: Math.round(faithfulness * 10000) / 10000,
        answer_relevancy: Math.round(answer_relevancy * 10000) / 10000,
        context_precision: Math.round(context_precision * 10000) / 10000,
        context_recall: Math.round(context_recall * 10000) / 10000,
        answer_correctness: Math.round(answer_correctness * 10000) / 10000,
        overall_score: Math.round(overall * 10000) / 10000,
      };
    });

    // Aggregate
    const avg = (key: string) => Math.round((scores.reduce((s: number, sc: Record<string, number>) => s + sc[key], 0) / scores.length) * 10000) / 10000;

    const ragas = {
      faithfulness: avg("faithfulness"),
      answer_relevancy: avg("answer_relevancy"),
      context_precision: avg("context_precision"),
      context_recall: avg("context_recall"),
      answer_correctness: avg("answer_correctness"),
      overall_score: avg("overall_score"),
      sample_count: scores.length,
    };

    // Store in DB if we have connection
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      if (supabaseUrl && supabaseKey && workspace_id) {
        const sb = createClient(supabaseUrl, supabaseKey);
        const inserts = scores.map((sc: Record<string, unknown>) => ({
          workspace_id,
          agent_id,
          query: sc.query,
          answer: test_cases.find((tc: { query: string }) => tc.query === sc.query)?.answer || "",
          faithfulness: sc.faithfulness,
          answer_relevancy: sc.answer_relevancy,
          context_precision: sc.context_precision,
          context_recall: sc.context_recall,
          answer_correctness: sc.answer_correctness,
          overall_score: sc.overall_score,
          contexts_count: test_cases.find((tc: { query: string }) => tc.query === sc.query)?.contexts?.length || 0,
        }));
        await sb.from("ragas_scores").insert(inserts);
      }
    } catch { /* best effort storage */ }

    return new Response(JSON.stringify({
      ragas,
      details: scores,
      processing_time_ms: Date.now() - start,
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
