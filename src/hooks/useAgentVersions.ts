import { useQuery } from '@tanstack/react-query';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

export interface AgentVersionRow {
  id: string;
  agent_id: string;
  version: number;
  model: string | null;
  persona: string | null;
  mission: string | null;
  name: string | null;
  config: Record<string, unknown>;
  change_summary: string | null;
  created_at: string;
  created_by: string | null;
}

export function useAgentVersions(agentId?: string) {
  return useQuery({
    queryKey: ['agent-versions', agentId],
    enabled: !!agentId,
    queryFn: async (): Promise<AgentVersionRow[]> => {
      const { data, error } = await supabaseExternal
        .from('agent_versions')
        .select('*')
        .eq('agent_id', agentId as string)
        .order('version', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as AgentVersionRow[];
    },
  });
}
