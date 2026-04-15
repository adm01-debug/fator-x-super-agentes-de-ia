import type { Database } from '@/integrations/supabase/types';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

type AgentStatus = Database['public']['Enums']['agent_status'];

export async function bulkUpdateStatus(ids: string[], status: AgentStatus): Promise<void> {
  const { error } = await supabaseExternal
    .from('agents')
    .update({ status })
    .in('id', ids);
  if (error) throw error;
}

export async function bulkDelete(ids: string[]): Promise<void> {
  const { error } = await supabaseExternal
    .from('agents')
    .delete()
    .in('id', ids);
  if (error) throw error;
}

export async function bulkAddTags(ids: string[], newTags: string[]): Promise<void> {
  // Fetch current tags for each agent, merge, and update
  const { data, error: fetchError } = await supabaseExternal
    .from('agents')
    .select('id, tags')
    .in('id', ids);
  if (fetchError) throw fetchError;

  for (const agent of data ?? []) {
    const merged = [...new Set([...(agent.tags ?? []), ...newTags])];
    const { error } = await supabaseExternal
      .from('agents')
      .update({ tags: merged })
      .eq('id', agent.id);
    if (error) throw error;
  }
}
