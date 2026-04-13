/**
 * Types for Knowledge Service
 */

export interface RerankResult {
  chunk: Record<string, unknown>;
  relevance_score: number;
}

export interface RerankResponse {
  reranked: RerankResult[];
  method: string;
  query: string;
  total_input: number;
  top_k: number;
}
