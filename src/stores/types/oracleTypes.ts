/**
 * Types for Oracle Store
 */

export type OracleMode = 'council' | 'researcher' | 'validator' | 'executor' | 'advisor';

export interface OraclePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  mode: OracleMode;
  members: Array<{ model: string; persona: string }>;
  chairman: string;
  enablePeerReview: boolean;
  enableThinking: boolean;
  criteriaWeights?: Record<string, number>;
}

export interface ModelResponse {
  index: number;
  model: string;
  persona: string;
  content: string;
  thinking?: string;
  tokens: { total: number };
  cost_usd: number;
  latency_ms: number;
  success: boolean;
}

export interface ConsensusPoint {
  id: string;
  claim: string;
  category: 'fact' | 'opinion' | 'recommendation' | 'risk' | 'number';
  modelPositions: Array<{
    model: string;
    position: 'agree' | 'disagree' | 'partially_agree' | 'not_mentioned';
    detail: string;
    confidence: number;
  }>;
  consensusLevel: 'strong' | 'partial' | 'disputed' | 'unique';
  resolution?: string;
}

export interface Citation {
  id: string;
  claim: string;
  sourceType: 'web' | 'model_consensus' | 'internal';
  sourceModel?: string;
  excerpt?: string;
  consensusLevel: number;
  verified: boolean;
}

export interface OracleResult {
  final_response: string;
  confidence_score: number;
  consensus_degree: number;
  stage1_results: ModelResponse[];
  stage2_results: Array<Record<string, unknown>>;
  consensus_points?: ConsensusPoint[];
  citations?: Citation[];
  metrics: {
    total_latency_ms: number;
    stage1_latency_ms: number;
    stage2_latency_ms: number;
    stage3_latency_ms: number;
    total_cost_usd: number;
    total_tokens: number;
    models_used: number;
  };
}
