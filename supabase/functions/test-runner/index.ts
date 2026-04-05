import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  category: string;
}

interface TestRunnerRequest {
  agent_id: string;
  dataset_id?: string;
  test_cases?: TestCase[];
}

interface TestResult {
  test_case_id: string;
  status: "passed" | "failed" | "error";
  score: number;
  actual_output: string;
  reason: string;
  latency_ms: number;
  cost_usd: number;
}

/**
 * Call the llm-gateway Edge Function internally to run a single prompt.
 */
async function callLLMGateway(
  supabaseUrl: string,
  serviceKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
): Promise<{ content: string; tokens_in: number; tokens_out: number; cost_usd: number; latency_ms: number }> {
  const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
  const res = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 1024 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`llm-gateway error ${res.status}: ${errText}`);
  }

  return await res.json();
}

/**
 * Simple similarity scoring: compare actual vs expected output.
 * Uses an LLM judge call to produce a 0-1 score.
 * Falls back to basic string overlap if the judge call fails.
 */
async function scoreOutput(
  supabaseUrl: string,
  serviceKey: string,
  input: string,
  expected: string,
  actual: string,
): Promise<{ score: number; reason: string; cost_usd: number }> {
  try {
    const judgePrompt = `You are an evaluation judge. Score the ACTUAL output against the EXPECTED output for the given INPUT.
Return a JSON object with exactly two keys: "score" (number 0.0-1.0) and "reason" (short explanation).

INPUT: ${input}
EXPECTED: ${expected}
ACTUAL: ${actual}

Return ONLY valid JSON, no markdown.`;

    const result = await callLLMGateway(supabaseUrl, serviceKey, "claude-sonnet-4-20250514", [
      { role: "user", content: judgePrompt },
    ], 0.0);

    const parsed = JSON.parse(result.content);
    return {
      score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
      reason: String(parsed.reason || ""),
      cost_usd: result.cost_usd ?? 0,
    };
  } catch {
    // Fallback: basic token overlap
    const expectedTokens = new Set(expected.toLowerCase().split(/\s+/));
    const actualTokens = new Set(actual.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const t of actualTokens) {
      if (expectedTokens.has(t)) overlap++;
    }
    const score = expectedTokens.size > 0 ? overlap / expectedTokens.size : 0;
    return {
      score: Math.round(score * 100) / 100,
      reason: "Scored via token overlap fallback",
      cost_usd: 0,
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agent_id, dataset_id, test_cases: providedCases } = (await req.json()) as TestRunnerRequest;

    if (!agent_id) {
      return new Response(
        JSON.stringify({ error: "agent_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startMs = Date.now();
    const evaluationRunId = crypto.randomUUID();

    // Resolve test cases: use provided or fetch from dataset
    let testCases: TestCase[] = providedCases ?? [];
    if (testCases.length === 0 && dataset_id) {
      const { data, error } = await supabase
        .from("evaluation_test_cases")
        .select("id, input, expected_output, category")
        .eq("dataset_id", dataset_id);
      if (error) throw new Error(`Failed to fetch test cases: ${error.message}`);
      testCases = (data ?? []) as TestCase[];
    }

    if (testCases.length === 0) {
      return new Response(
        JSON.stringify({ error: "No test cases provided or found in dataset" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load agent config for system prompt
    const { data: agentData } = await supabase
      .from("agents")
      .select("name, system_prompt, model, temperature")
      .eq("id", agent_id)
      .single();

    const agentModel = agentData?.model ?? "claude-sonnet-4-20250514";
    const agentTemp = agentData?.temperature ?? 0.7;
    const systemPrompt = agentData?.system_prompt ?? "You are a helpful assistant.";

    // Run each test case
    const results: TestResult[] = [];

    for (const tc of testCases) {
      const caseStart = Date.now();
      try {
        // Generate agent response
        const llmResult = await callLLMGateway(supabaseUrl, supabaseServiceKey, agentModel, [
          { role: "system", content: systemPrompt },
          { role: "user", content: tc.input },
        ], agentTemp);

        const actualOutput = llmResult.content;
        const caseCost = llmResult.cost_usd ?? 0;

        // Score the output
        const scoring = await scoreOutput(supabaseUrl, supabaseServiceKey, tc.input, tc.expected_output, actualOutput);

        const totalCaseCost = caseCost + scoring.cost_usd;
        const status = scoring.score >= 0.7 ? "passed" : "failed";

        results.push({
          test_case_id: tc.id,
          status,
          score: scoring.score,
          actual_output: actualOutput,
          reason: scoring.reason,
          latency_ms: Date.now() - caseStart,
          cost_usd: totalCaseCost,
        });
      } catch (err) {
        results.push({
          test_case_id: tc.id,
          status: "error",
          score: 0,
          actual_output: "",
          reason: err instanceof Error ? err.message : "Unknown error",
          latency_ms: Date.now() - caseStart,
          cost_usd: 0,
        });
      }
    }

    // Aggregate
    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const errors = results.filter((r) => r.status === "error").length;
    const totalTests = results.length;
    const passRate = totalTests > 0 ? passed / totalTests : 0;
    const avgScore = totalTests > 0 ? results.reduce((s, r) => s + r.score, 0) / totalTests : 0;
    const totalCostUsd = results.reduce((s, r) => s + r.cost_usd, 0);
    const durationMs = Date.now() - startMs;

    // Persist evaluation run
    try {
      await supabase.from("evaluation_runs").insert({
        id: evaluationRunId,
        agent_id,
        dataset_id: dataset_id ?? null,
        total_tests: totalTests,
        passed,
        failed,
        errors,
        pass_rate: passRate,
        avg_score: avgScore,
        total_cost_usd: totalCostUsd,
        duration_ms: durationMs,
      });
    } catch {
      // Non-critical
    }

    const payload = {
      evaluation_run_id: evaluationRunId,
      total_tests: totalTests,
      passed,
      failed,
      errors,
      pass_rate: Math.round(passRate * 100) / 100,
      avg_score: Math.round(avgScore * 100) / 100,
      total_cost_usd: totalCostUsd,
      duration_ms: durationMs,
      results,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
