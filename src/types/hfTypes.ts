/**
 * Types for tables created by Supabase MCP deployment
 * (HF improvements M01-M42)
 */

export interface EmbeddingConfig {
  id: string;
  workspace_id: string | null;
  knowledge_base_id: string | null;
  provider: string;
  dimension: number;
  task: string;
  reranker_model: string | null;
  reranker_top_k: number;
  hybrid_search: boolean;
  created_at: string;
  updated_at: string;
}

export interface RAGASScore {
  id: string;
  workspace_id: string | null;
  agent_id: string | null;
  evaluation_run_id: string | null;
  query: string;
  answer: string;
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
  answer_correctness: number;
  overall_score: number;
  contexts_count: number;
  model_used: string | null;
  created_at: string;
}

export interface NLPExtraction {
  id: string;
  workspace_id: string | null;
  source_type: string;
  source_id: string | null;
  raw_text: string;
  entities: Record<string, unknown>;
  structured_order: Record<string, unknown>;
  sentiment_label: string | null;
  sentiment_score: number | null;
  pipeline_version: string;
  processing_time_ms: number | null;
  created_at: string;
}

export interface GuardrailMLLog {
  id: string;
  workspace_id: string | null;
  agent_id: string | null;
  direction: 'input' | 'output';
  text_preview: string | null;
  all_passed: boolean;
  blocked_layers: string[];
  scores: Record<string, unknown>;
  latency_ms: number | null;
  created_at: string;
}

export interface ModelPricingV2 {
  id: string;
  model: string;
  provider: string;
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  tier: string;
  capabilities: string[];
  context_window: number;
  active_params: string | null;
  total_params: string | null;
  created_at: string;
}
