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
  const { error } = await supabase
    .from('evaluation_runs')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function createEvaluationDataset(dataset: { name: string; description?: string; workspace_id?: string }) {
  const { data, error } = await supabase
    .from('evaluation_datasets')
    .insert(dataset)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTestCase(tc: { dataset_id: string; input: string; expected_output?: string; tags?: string[] }) {
  const { data, error } = await supabase
    .from('test_cases')
    .insert(tc)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTestCase(id: string) {
  const { error } = await supabase.from('test_cases').delete().eq('id', id);
  if (error) throw error;
}

export async function updateDatasetCaseCount(datasetId: string) {
  const { count } = await supabase.from('test_cases').select('id', { count: 'exact', head: true }).eq('dataset_id', datasetId);
  await supabase.from('evaluation_datasets').update({ case_count: count ?? 0 }).eq('id', datasetId);
}

export async function invokeEvalJudge(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('eval-judge', { body });
  if (error) throw error;
  return data;
}

export async function listAgentsForSelect() {
  const { data } = await supabase.from('agents').select('id, name').order('name');
  return data ?? [];
}

// ═══ Types ═══

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  rubric?: string;
  tags: string[];
  weight: number;
}

export interface EvalResult {
  test_case_id: string;
  input: string;
  expected: string;
  actual: string;
  scores: {
    deterministic: number;  // 0-1: regex, format, exact match
    statistical: number;    // 0-1: BLEU, ROUGE-L, cosine similarity
    llm_judge: number;      // 0-1: LLM-as-Judge semantic quality
    combined: number;       // Weighted average
  };
  latency_ms: number;
  tokens_used: number;
  cost_usd: number;
  status: 'pass' | 'fail' | 'partial';
}

export interface CLEARScore {
  cost: number;        // Cost per interaction (lower = better)
  latency: number;     // P95 latency in ms (lower = better)
  efficiency: number;  // Tokens per useful response (lower = better)
  assurance: number;   // % guardrails NOT triggered (higher = better)
  reliability: number; // % successful executions (higher = better)
  overall: number;     // 0-100 composite score
}

// Deterministic checks
function scoreDeterministic(expected: string, actual: string): number {
  if (!expected || !actual) return 0;

  let score = 0;
  let checks = 0;

  // Exact match (case-insensitive)
  checks++;
  if (actual.toLowerCase().includes(expected.toLowerCase())) score++;

  // Format check (JSON if expected is JSON)
  try {
    JSON.parse(expected);
    checks++;
    try { JSON.parse(actual); score++; } catch (err) { logger.error("Operation failed:", err); /* not JSON */ }
  } catch (err) { logger.error("Operation failed:", err); /* expected is not JSON */ }

  // Length sanity (not too short, not too long)
  checks++;
  if (actual.length > 10 && actual.length < expected.length * 5) score++;

  return checks > 0 ? score / checks : 0;
}

// Statistical similarity (simplified ROUGE-like)
function scoreStatistical(expected: string, actual: string): number {
  if (!expected || !actual) return 0;

  const expectedWords = new Set(expected.toLowerCase().split(/\s+/));
  const actualWords = new Set(actual.toLowerCase().split(/\s+/));

  let overlap = 0;
  expectedWords.forEach(w => { if (actualWords.has(w)) overlap++; });

  const precision = actualWords.size > 0 ? overlap / actualWords.size : 0;
  const recall = expectedWords.size > 0 ? overlap / expectedWords.size : 0;

  // F1 score
  return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
}

export async function runEvaluation(
  _agentId: string,
  testCases: TestCase[],
  model: string = 'claude-haiku-4-5-20251001'
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
          'Authorization': `Bearer ${token}`,
          'apikey': apiKey,
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
      const tokens = ((data as Record<string, Record<string, number>>).usage?.total_tokens) || 0;

      const deterministic = scoreDeterministic(tc.expected_output, actual);
      const statistical = scoreStatistical(tc.expected_output, actual);
      const combined = deterministic * 0.3 + statistical * 0.7;

      results.push({
        test_case_id: tc.id,
        input: tc.input,
        expected: tc.expected_output,
        actual,
        scores: { deterministic, statistical, llm_judge: 0, combined },
        latency_ms: latencyMs,
        tokens_used: tokens,
        cost_usd: tokens * 0.000001,
        status: combined > 0.7 ? 'pass' : combined > 0.4 ? 'partial' : 'fail',
      });
    } catch (err) { logger.error("Operation failed:", err);
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
  const avgCost = results.reduce((s, r) => s + r.cost_usd, 0) / results.length;
  const p95Latency = results.map(r => r.latency_ms).sort((a, b) => a - b)[Math.floor(results.length * 0.95)] || 0;
  const avgTokens = results.reduce((s, r) => s + r.tokens_used, 0) / results.length;
  const successRate = results.filter(r => r.status !== 'fail').length / results.length;

  const clear: CLEARScore = {
    cost: Math.max(0, 100 - avgCost * 10000),
    latency: Math.max(0, 100 - (p95Latency / 100)),
    efficiency: Math.max(0, 100 - (avgTokens / 50)),
    assurance: 85, // Will be populated by guardrails integration
    reliability: successRate * 100,
    overall: 0,
  };
  clear.overall = Math.round((clear.cost + clear.latency + clear.efficiency + clear.assurance + clear.reliability) / 5);

  return { results, clear };
}
