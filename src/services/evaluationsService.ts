/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Evaluations Service (CLEAR Framework)
 * ═══════════════════════════════════════════════════════════════
 * Multi-level evaluation: Deterministic → Statistical → LLM-as-Judge
 * CLEAR: Cost, Latency, Efficiency, Assurance, Reliability
 * Reference: arXiv 2511.14136, RAGAS, SWE-bench
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

// ═══ CRUD ═══

export async function listEvaluationRuns() {
  const { data, error } = await supabase
    .from('evaluation_runs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listEvaluationDatasets() {
  const { data, error } = await supabase
    .from('evaluation_datasets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listTestCases(datasetId: string) {
  const { data, error } = await supabase
    .from('test_cases')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createEvaluationRun(run: {
  name: string;
  agent_id: string;
  dataset_id: string;
  test_cases: number;
  workspace_id?: string;
  status?: string;
}) {
  const { data, error } = await supabase
    .from('evaluation_runs')
    .insert({ ...run, status: run.status || 'running' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvaluationRun(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from('evaluation_runs').update(updates).eq('id', id);
  if (error) throw error;
}

export async function createEvaluationDataset(dataset: {
  name: string;
  description?: string;
  workspace_id?: string;
}) {
  const { data, error } = await supabase
    .from('evaluation_datasets')
    .insert(dataset)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTestCase(tc: {
  dataset_id: string;
  input: string;
  expected_output?: string;
  tags?: string[];
}) {
  const { data, error } = await supabase.from('test_cases').insert(tc).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTestCase(id: string) {
  const { error } = await supabase.from('test_cases').delete().eq('id', id);
  if (error) throw error;
}

export async function updateDatasetCaseCount(datasetId: string) {
  const { count, error: countErr } = await supabase
    .from('test_cases')
    .select('id', { count: 'exact', head: true })
    .eq('dataset_id', datasetId);
  if (countErr) {
    logger.error('Failed to count test cases', { datasetId, error: countErr.message });
    throw countErr;
  }
  const { error: updateErr } = await supabase
    .from('evaluation_datasets')
    .update({ case_count: count ?? 0 })
    .eq('id', datasetId);
  if (updateErr) {
    logger.error('Failed to update dataset case count', { datasetId, error: updateErr.message });
    throw updateErr;
  }
}

export async function invokeEvalJudge(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('eval-judge', { body });
  if (error) throw error;
  return data;
}

export async function listAgentsForSelect() {
  const { data, error } = await supabase.from('agents').select('id, name').order('name');
  if (error) {
    logger.error('Failed to list agents for select', { error: error.message });
    throw error;
  }
  return data ?? [];
}

export type { TestCase, EvalResult, CLEARScore } from './types/evaluationsTypes';
import type { EvalResult, CLEARScore } from './types/evaluationsTypes';

/**
 * Deterministic scoring — checks structural/content correctness.
 * Multiple criteria: containment, exact match, JSON structure, length.
 */
function scoreDeterministic(expected: string, actual: string): number {
  if (!expected || !actual) return 0;

  const weights: Array<{ score: number; weight: number }> = [];

  // 1. Case-insensitive containment (weak)
  const containsExpected = actual.toLowerCase().includes(expected.toLowerCase().substring(0, 200));
  weights.push({ score: containsExpected ? 1 : 0, weight: 0.15 });

  // 2. Normalized exact match (strong — strip whitespace, lowercase)
  const normExpected = expected.trim().toLowerCase().replace(/\s+/g, ' ');
  const normActual = actual.trim().toLowerCase().replace(/\s+/g, ' ');
  const exactMatch = normExpected === normActual;
  weights.push({ score: exactMatch ? 1 : 0, weight: 0.3 });

  // 3. JSON structure matching (if applicable)
  try {
    const expObj = JSON.parse(expected);
    try {
      const actObj = JSON.parse(actual);
      // Check key overlap
      const expKeys = new Set(Object.keys(expObj));
      const actKeys = new Set(Object.keys(actObj));
      const commonKeys = [...expKeys].filter((k) => actKeys.has(k));
      const keyOverlap = expKeys.size > 0 ? commonKeys.length / expKeys.size : 0;
      weights.push({ score: keyOverlap, weight: 0.3 });
    } catch {
      weights.push({ score: 0, weight: 0.3 });
    }
  } catch {
    // Expected is not JSON — skip JSON checks and redistribute weight
    // Check key phrase containment instead
    const phrases = expected.split(/[.!?\n]/).filter((p) => p.trim().length > 10);
    if (phrases.length > 0) {
      const matched = phrases.filter((p) =>
        actual.toLowerCase().includes(p.trim().toLowerCase().substring(0, 80)),
      );
      weights.push({ score: matched.length / phrases.length, weight: 0.3 });
    }
  }

  // 4. Length sanity (response should be reasonable length relative to expected)
  const ratio = actual.length / Math.max(expected.length, 1);
  const lengthScore = ratio >= 0.3 && ratio <= 5 ? 1 : ratio >= 0.1 && ratio <= 10 ? 0.5 : 0;
  weights.push({ score: lengthScore, weight: 0.25 });

  // Weighted average
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  return totalWeight > 0 ? weights.reduce((s, w) => s + w.score * w.weight, 0) / totalWeight : 0;
}

/**
 * Statistical scoring — ROUGE-L based on Longest Common Subsequence.
 * More robust than simple word overlap: captures ordering and sequence.
 */
function scoreStatistical(expected: string, actual: string): number {
  if (!expected || !actual) return 0;

  const expTokens = expected
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const actTokens = actual
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (expTokens.length === 0 || actTokens.length === 0) return 0;

  // Compute LCS length (ROUGE-L)
  const lcsLen = lcsLength(expTokens, actTokens);

  const precision = lcsLen / actTokens.length;
  const recall = lcsLen / expTokens.length;

  // F1 of ROUGE-L
  const rougeL = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Also compute unigram F1 (ROUGE-1) for robustness
  const expSet = new Set(expTokens);
  const actSet = new Set(actTokens);
  let unigramOverlap = 0;
  expSet.forEach((w) => {
    if (actSet.has(w)) unigramOverlap++;
  });
  const uniPrecision = actSet.size > 0 ? unigramOverlap / actSet.size : 0;
  const uniRecall = expSet.size > 0 ? unigramOverlap / expSet.size : 0;
  const rouge1 =
    uniPrecision + uniRecall > 0 ? (2 * uniPrecision * uniRecall) / (uniPrecision + uniRecall) : 0;

  // Blend ROUGE-L (60%) with ROUGE-1 (40%)
  return rougeL * 0.6 + rouge1 * 0.4;
}

/** Longest Common Subsequence length — O(m*n) DP */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Use single-row optimization for memory efficiency
  const prev = new Array<number>(n + 1).fill(0);
  const curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    for (let j = 0; j <= n; j++) {
      prev[j] = curr[j];
      curr[j] = 0;
    }
  }
  return prev[n];
}

export async function runEvaluation(
  _agentId: string,
  testCases: TestCase[],
  model: string = 'claude-haiku-4-5-20251001',
): Promise<{ results: EvalResult[]; clear: CLEARScore }> {
  const results: EvalResult[] = [];
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  for (const tc of testCases) {
    const start = Date.now();

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: tc.input }],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      const data = await resp.json();
      const actual = String((data as Record<string, unknown>).content || '');
      const latencyMs = Date.now() - start;
      const tokens = (data as Record<string, Record<string, number>>).usage?.total_tokens || 0;

      const deterministic = scoreDeterministic(tc.expected_output, actual);
      const statistical = scoreStatistical(tc.expected_output, actual);

      // LLM-as-Judge: use a fast model to evaluate semantic quality
      let llmJudge = 0;
      if (tc.expected_output && actual && actual !== 'ERROR') {
        try {
          const judgeResp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              apikey: apiKey,
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              messages: [
                {
                  role: 'user',
                  content: `Rate how well the ACTUAL response matches the EXPECTED response on a scale of 0.0 to 1.0. Only output a single decimal number, nothing else.\n\nEXPECTED: ${tc.expected_output.substring(0, 500)}\n\nACTUAL: ${actual.substring(0, 500)}`,
                },
              ],
              temperature: 0,
              max_tokens: 10,
            }),
          });
          const judgeData = await judgeResp.json();
          const judgeContent = String((judgeData as Record<string, unknown>).content || '0');
          const parsed = parseFloat(judgeContent.trim());
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            llmJudge = parsed;
          }
        } catch {
          // LLM judge is best-effort; fall back to 0
        }
      }

      const combined = deterministic * 0.2 + statistical * 0.4 + llmJudge * 0.4;

      results.push({
        test_case_id: tc.id,
        input: tc.input,
        expected: tc.expected_output,
        actual,
        scores: { deterministic, statistical, llm_judge: llmJudge, combined },
        latency_ms: latencyMs,
        tokens_used: tokens,
        cost_usd: tokens * 0.000001,
        status: combined > 0.7 ? 'pass' : combined > 0.4 ? 'partial' : 'fail',
      });
    } catch (err) {
      logger.error('Operation failed:', err);
      results.push({
        test_case_id: tc.id,
        input: tc.input,
        expected: tc.expected_output,
        actual: 'ERROR',
        scores: { deterministic: 0, statistical: 0, llm_judge: 0, combined: 0 },
        latency_ms: Date.now() - start,
        tokens_used: 0,
        cost_usd: 0,
        status: 'fail',
      });
    }
  }

  // Calculate CLEAR score
  const n = results.length || 1; // guard against division by zero
  const avgCost = results.reduce((s, r) => s + r.cost_usd, 0) / n;
  const sortedLatencies = results.map((r) => r.latency_ms).sort((a, b) => a - b);
  const p95Latency = sortedLatencies[Math.floor(n * 0.95)] || 0;
  const avgTokens = results.reduce((s, r) => s + r.tokens_used, 0) / n;
  const successRate = results.filter((r) => r.status !== 'fail').length / n;

  // Assurance: average llm_judge score across all results (0–100)
  const avgJudge = results.reduce((s, r) => s + r.scores.llm_judge, 0) / n;
  const assurance = Math.round(avgJudge * 100);

  const clear: CLEARScore = {
    cost: Math.max(0, 100 - avgCost * 10000),
    latency: Math.max(0, 100 - p95Latency / 100),
    efficiency: Math.max(0, 100 - avgTokens / 50),
    assurance,
    reliability: successRate * 100,
    overall: 0,
  };
  clear.overall = Math.round(
    (clear.cost + clear.latency + clear.efficiency + clear.assurance + clear.reliability) / 5,
  );

  return { results, clear };
}
