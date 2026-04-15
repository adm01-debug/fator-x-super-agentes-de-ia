import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal } from "@/integrations/supabase/externalClient";
import { getWorkspaceId } from "@/lib/agentService";

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabaseExternal
        .from('agents')
        .select('id, name, mission, avatar_emoji, status, model, tags, version, updated_at, persona, reasoning, config, user_id, workspace_id, created_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: async () => {
      const { data, error } = await supabaseExternal.from('agents').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useWorkspace() {
  return useQuery({
    queryKey: ['workspace_settings'],
    queryFn: async () => {
      const wsId = await getWorkspaceId();
      const { data } = await supabaseExternal.from('workspaces').select('*').eq('id', wsId).maybeSingle();
      return data;
    },
  });
}

export function useWorkspaceId() {
  return useQuery({
    queryKey: ['workspace_id'],
    queryFn: () => getWorkspaceId(),
    staleTime: Infinity,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (key: string | string[]) => qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
}
