/**
 * Nexus — Semantic + Visual Search Service
 * Wraps semantic-search and visual-search edge functions.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface SemanticSearchResult {
  chunk_id: string;
  document_id: string | null;
  document_title: string | null;
  source_url: string | null;
  content: string;
  similarity: number;
  matched_via: "vector" | "trigram" | "ilike";
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  cached: boolean;
  total: number;
}

export interface VisualSearchResponse {
  description: string;
  results: SemanticSearchResult[];
  total: number;
}

export async function semanticSearch(
  query: string,
  options?: { knowledgeBaseId?: string | null; topK?: number },
): Promise<SemanticSearchResponse> {
  const { data, error } = await supabase.functions.invoke("semantic-search", {
    body: {
      query,
      knowledge_base_id: options?.knowledgeBaseId ?? null,
      top_k: options?.topK ?? 10,
    },
  });
  if (error) {
    logger.error("semantic-search failed", { error: error.message });
    throw new Error(error.message);
  }
  return (data as SemanticSearchResponse) ?? { results: [], cached: false, total: 0 };
}

export async function visualSearch(
  imageBase64: string,
  options?: {
    hint?: string;
    knowledgeBaseId?: string | null;
    topK?: number;
  },
): Promise<VisualSearchResponse> {
  const { data, error } = await supabase.functions.invoke("visual-search", {
    body: {
      image: imageBase64,
      hint: options?.hint ?? "",
      knowledge_base_id: options?.knowledgeBaseId ?? null,
      top_k: options?.topK ?? 10,
    },
  });
  if (error) {
    logger.error("visual-search failed", { error: error.message });
    throw new Error(error.message);
  }
  return (
    (data as VisualSearchResponse) ?? { description: "", results: [], total: 0 }
  );
}

/** Reads a File as base64 data URL */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}
