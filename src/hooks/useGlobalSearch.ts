import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";

export interface GlobalSearchHit {
  type: "agent" | "knowledge_base" | "article" | "workflow" | "eval_dataset" | "automation" | "document";
  id: string;
  title: string;
  snippet: string;
  url: string;
  score: number;
  lexical_score?: number;
  semantic_score?: number;
  meta?: Record<string, unknown>;
}

export interface GlobalSearchResponse {
  hits: GlobalSearchHit[];
  mode: string;
}

export function useGlobalSearch(query: string, enabled: boolean = true) {
  const debounced = useDebounce(query, 250);

  const result = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async (): Promise<GlobalSearchResponse> => {
      if (debounced.trim().length < 2) return { hits: [], mode: "empty" };
      const { data, error } = await supabase.functions.invoke("global-search", {
        body: { query: debounced, limit: 8, semantic: true },
      });
      if (error) throw error;
      return {
        hits: (data?.results ?? []) as GlobalSearchHit[],
        mode: String(data?.mode ?? "lexical"),
      };
    },
    enabled: enabled && debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  return {
    ...result,
    data: result.data?.hits ?? [],
    mode: result.data?.mode ?? "lexical",
  };
}
