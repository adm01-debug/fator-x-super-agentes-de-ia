/**
 * Edge Function Client — Calls Supabase Edge Functions from the frontend
 * Wraps fetch calls to Edge Functions with proper auth headers.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface EdgeFunctionResult<T = unknown> {
  data: T | null;
  error: string | null;
}

// ═══ BASE CALLER ═══

async function callEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<EdgeFunctionResult<T>> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (error) {
      logger.error(`Edge Function ${functionName} error: ${error.message}`, error, 'edgeFunctions');
      return { data: null, error: error.message };
    }

    return { data: data as T, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Edge Function ${functionName} failed: ${msg}`, err, 'edgeFunctions');
    return { data: null, error: msg };
  }
}

// ═══ RAG INGEST ═══

export interface RagIngestResult {
  document_id: string;
  chunks_created: number;
  embeddings_generated: number;
  duration_ms: number;
}

/** Call the rag-ingest Edge Function to process a document with real embeddings. */
export async function ragIngest(params: {
  knowledge_base_id: string;
  document_name: string;
  content: string;
  chunk_size?: number;
  chunk_overlap?: number;
  embedding_model?: string;
}): Promise<EdgeFunctionResult<RagIngestResult>> {
  return callEdgeFunction<RagIngestResult>('rag-ingest', {
    knowledge_base_id: params.knowledge_base_id,
    document_name: params.document_name,
    content: params.content,
    chunk_size: params.chunk_size ?? 512,
    chunk_overlap: params.chunk_overlap ?? 50,
    embedding_model: params.embedding_model ?? 'text-embedding-3-small',
  });
}

// ═══ TEST RUNNER ═══

export interface TestRunnerResult {
  evaluation_run_id: string;
  total_tests: number;
  passed: number;
  failed: number;
  errors: number;
  pass_rate: number;
  avg_score: number;
  total_cost_usd: number;
  duration_ms: number;
  results: {
    test_case_id: string;
    status: 'passed' | 'failed' | 'error';
    score: number;
    actual_output: string;
    reason: string;
    latency_ms: number;
    cost_usd: number;
  }[];
}

/** Call the test-runner Edge Function to execute evaluation test cases. */
export async function runTestSuite(params: {
  agent_id: string;
  dataset_id?: string;
  test_cases?: { id: string; input: string; expected_output: string; category: string }[];
}): Promise<EdgeFunctionResult<TestRunnerResult>> {
  return callEdgeFunction<TestRunnerResult>('test-runner', params);
}

// ═══ WORKFLOW ENGINE ═══

export interface WorkflowRunResult {
  run_id: string;
  status: 'completed' | 'failed' | 'partial';
  steps: { step_id: string; status: string; output: string; duration_ms: number; cost_usd: number }[];
  total_duration_ms: number;
  total_cost_usd: number;
  final_output: string;
}

/** Call the workflow-engine Edge Function to execute a workflow. */
export async function executeWorkflow(params: {
  workflow_id: string;
  input: string;
}): Promise<EdgeFunctionResult<WorkflowRunResult>> {
  return callEdgeFunction<WorkflowRunResult>('workflow-engine', params);
}

// ═══ LLM GATEWAY ═══

export interface GatewayResult {
  content: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  trace_id: string;
}

/** Call the llm-gateway Edge Function for a single LLM call. */
export async function llmGateway(params: {
  agent_id?: string;
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
}): Promise<EdgeFunctionResult<GatewayResult>> {
  return callEdgeFunction<GatewayResult>('llm-gateway', params);
}

// ═══ ORACLE COUNCIL ═══

export interface OracleResult {
  consultation_id: string;
  consensus_score: number;
  synthesis: string;
  responses: { model: string; content: string; score: number }[];
  total_cost_usd: number;
  duration_ms: number;
}

/** Call the oracle-council Edge Function for multi-model deliberation. */
export async function oracleConsult(params: {
  query: string;
  preset_id?: string;
  mode?: string;
  models?: string[];
}): Promise<EdgeFunctionResult<OracleResult>> {
  return callEdgeFunction<OracleResult>('oracle-council', params);
}

// ═══ CEREBRO QUERY ═══

export interface CerebroResult {
  answer: string;
  facts: { content: string; confidence: number; source: string }[];
  entities: { name: string; type: string; relationships: number }[];
}

/** Call the cerebro-query Edge Function for knowledge queries. */
export async function cerebroQuery(params: {
  query: string;
  include_external_dbs?: boolean;
}): Promise<EdgeFunctionResult<CerebroResult>> {
  return callEdgeFunction<CerebroResult>('cerebro-query', params);
}
