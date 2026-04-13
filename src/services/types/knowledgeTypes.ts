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

export type DocOcrAction = 'ocr' | 'describe' | 'extract_table' | 'extract_fields';

export interface DocOcrOptions {
  action?: DocOcrAction;
  imageBase64?: string;
  imageUrl?: string;
  prompt?: string;
  fields?: string[];
}

export interface DocOcrResult {
  text: string;
  action: DocOcrAction;
  model: string;
}
