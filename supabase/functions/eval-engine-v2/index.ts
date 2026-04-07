/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Eval Engine v2 (RAGAS metrics)
 * ═══════════════════════════════════════════════════════════════
 * RAG quality evaluation following the RAGAS framework.
 *
 * Computes 5 metrics per test case:
 *   • faithfulness         — answer is grounded in retrieved context
 *   • answer_relevancy     — answer addresses the query
 *   • context_precision    — retrieved chunks are relevant
 *   • context_recall       — retrieved chunks cover the answer
 *   • answer_correctness   — answer matches expected (if provided)
 *
 * Strategy: LLM-as-judge via llm-gateway with structured JSON output.
 * Falls back to lexical heuristics (Jaccard) if LLM unavailable.
 *
 * Persists results to `eval_runs` table for trend analysis.
 *
 * Used by: src/services/evalEngineService.ts
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
const TestCase = z.object({
  query: z.string().min(1).max(2000),
  answer: z.string().min(1).max(8000),
  contexts: z.array(z.string().min(1).max(8000)).min(0).max(20),
  expected_answer: z.string().max(8000).optional(),
});

const EvalInput = z.object({
  workspace_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  test_cases: z.array(TestCase).min(1).max(50),
  run_ragas: z.boolean().default(true),
});

type TestCaseT = z.infer<typeof TestCase>;

interface RAGASScores {
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
  answer_correctness: number;
}

// ═══ Lexical Fallback (Jaccard similarity over token sets) ═══
function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return inter.size / union.size;
}

function evalLexical(tc: TestCaseT): RAGASScores {
  const queryTokens = tokenize(tc.query);
  const answerTokens = tokenize(tc.answer);
  const contextsJoined = tc.contexts.join(' ');
  const contextTokens = tokenize(contextsJoined);

  // faithfulness: how much of the answer is in the context
  const answerInContext = jaccard(answerTokens, contextTokens);

  // answer_relevancy: how well the answer addresses the query
  const answerRelevancy = jaccard(queryTokens, answerTokens);

  // context_precision: how relevant the contexts are to the query
  const contextPrecisions = tc.contexts.map(c => jaccard(queryTokens, tokenize(c)));
  const contextPrecision = contextPrecisions.length
    ? contextPrecisions.reduce((s, v) => s + v, 0) / contextPrecisions.length
    : 0;

  // context_recall: how much of the answer is in the contexts
  const contextRecall = answerInContext;

  // answer_correctness: vs expected
  const answerCorrectness = tc.expected_answer
    ? jaccard(answerTokens, tokenize(tc.expected_answer))
    : 0;

  return {
    faithfulness: Number(answerInContext.toFixed(3)),
    answer_relevancy: Number(answerRelevancy.toFixed(3)),
    context_precision: Number(contextPrecision.toFixed(3)),
    context_recall: Number(contextRecall.toFixed(3)),
    answer_correctness: Number(answerCorrectness.toFixed(3)),
  };
}

// ═══ LLM-as-Judge ═══
async function evalLLM(
  tc: TestCaseT,
  supabaseUrl: string,
  authHeader: string,
): Promise<RAGASScores | null> {
  const judgePrompt = `You are an evaluation judge for a RAG system. Score the following test case on 5 metrics from 0.0 to 1.0.

QUERY: ${tc.query}
ANSWER: ${tc.answer}
CONTEXTS:
${tc.contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n')}
${tc.expected_answer ? `EXPECTED: ${tc.expected_answer}` : ''}

Respond ONLY with valid JSON in this exact shape, no other text:
{"faithfulness":0.0,"answer_relevancy":0.0,"context_precision":0.0,"context_recall":0.0,"answer_correctness":0.0}

Metrics:
- faithfulness: 1.0 if every claim in ANSWER is supported by CONTEXTS, 0.0 if hallucinated
- answer_relevancy: 1.0 if ANSWER directly addresses QUERY
- context_precision: 1.0 if every context chunk is relevant to QUERY
- context_recall: 1.0 if CONTEXTS contain all info needed for ANSWER
- answer_correctness: 1.0 if ANSWER matches EXPECTED (or 0.5 if no expected provided)`;

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: judgePrompt }],
        temperature: 0,
        max_tokens: 200,
        stream: false,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content: string = data.content ?? data.message?.content ?? '';
    // Extract first JSON object from response
    const match = content.match(/\{[^{}]*"faithfulness"[^{}]*\}/);
    if (!match) return null;
    const scores = JSON.parse(match[0]);
    return {
      faithfulness: clamp01(scores.faithfulness),
      answer_relevancy: clamp01(scores.answer_relevancy),
      context_precision: clamp01(scores.context_precision),
      context_recall: clamp01(scores.context_recall),
      answer_correctness: clamp01(scores.answer_correctness),
    };
  } catch {
    return null;
  }
}

function clamp01(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

// ═══ Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.heavy);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, EvalInput);
    if (parsed.error) return parsed.error;
    const { workspace_id, agent_id, test_cases } = parsed.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const authHeader = req.headers.get('authorization') ?? '';

    // Score each test case (try LLM, fall back to lexical)
    const perCaseScores: RAGASScores[] = [];
    for (const tc of test_cases) {
      const llmScores = await evalLLM(tc, supabaseUrl, authHeader);
      perCaseScores.push(llmScores ?? evalLexical(tc));
    }

    // Average all scores across test cases
    const n = perCaseScores.length;
    const avg: RAGASScores = {
      faithfulness: 0,
      answer_relevancy: 0,
      context_precision: 0,
      context_recall: 0,
      answer_correctness: 0,
    };
    for (const s of perCaseScores) {
      avg.faithfulness += s.faithfulness;
      avg.answer_relevancy += s.answer_relevancy;
      avg.context_precision += s.context_precision;
      avg.context_recall += s.context_recall;
      avg.answer_correctness += s.answer_correctness;
    }
    for (const k of Object.keys(avg) as (keyof RAGASScores)[]) {
      avg[k] = Number((avg[k] / n).toFixed(3));
    }

    const overall_score = Number(
      ((avg.faithfulness + avg.answer_relevancy + avg.context_precision + avg.context_recall + avg.answer_correctness) / 5).toFixed(3),
    );

    // Persist if eval_runs table exists (best-effort, don't fail if missing)
    if (workspace_id && agent_id) {
      try {
        await supabase.from('eval_runs').insert({
          workspace_id,
          agent_id,
          metric_type: 'ragas',
          scores: { ...avg, overall_score },
          sample_count: n,
          created_by: user.id,
        });
      } catch {
        // Best effort — table may not exist yet
      }
    }

    return jsonResponse(req, {
      ragas: {
        ...avg,
        overall_score,
        sample_count: n,
      },
      version: 'eval-engine-v2.0',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(req, message, 500);
  }
});
