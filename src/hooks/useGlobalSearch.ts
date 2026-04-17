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
  meta?: Record<string, unknown>;
}

export function useGlobalSearch(query: string, enabled: boolean = true) {
  const debounced = useDebounce(query, 250);

  return useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async (): Promise<GlobalSearchHit[]> => {
      if (debounced.trim().length < 2) return [];
      const { data, error } = await supabase.functions.invoke("global-search", {
        body: { query: debounced, limit: 6 },
      });
      if (error) throw error;
      return (data?.results ?? []) as GlobalSearchHit[];
    },
    enabled: enabled && debounced.trim().length >= 2,
    staleTime: 30_000,
  });
}
