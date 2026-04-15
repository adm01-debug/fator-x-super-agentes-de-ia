/**
 * Nexus — Eval Engine Service (RAGAS metrics)
 * Connects to eval-engine-v2 for RAG quality evaluation.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export interface RAGASResult {
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
  answer_correctness: number;
  overall_score: number;
  sample_count: number;
}

export interface EvalTestCase {
  query: string;
  answer: string;
  contexts: string[];
  expected_answer?: string;
}

export async function runRAGASEvaluation(
  workspaceId: string,
  agentId: string,
  testCases: EvalTestCase[]
): Promise<{ ragas: RAGASResult }> {
  const { data, error } = await supabase.functions.invoke('eval-engine-v2', {
    body: { workspace_id: workspaceId, agent_id: agentId, test_cases: testCases, run_ragas: true },
  });
  if (error) {
    logger.error('RAGAS evaluation failed', { error: error.message, agentId });
    throw new Error(`Eval error: ${error.message}`);
  }
  return data as { ragas: RAGASResult };
}

export async function getAgentRAGASAverage(agentId: string) {
  const { data, error } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)('get_ragas_avg', { p_agent_id: agentId });
  if (error) {
    logger.error('RAGAS avg query failed', { error: error.message, agentId });
    throw new Error(`RAGAS avg error: ${error.message}`);
  }
  return (data as Record<string, unknown>[])?.[0] ?? null;
}
