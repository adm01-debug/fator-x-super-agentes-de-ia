/**
 * useRealtimeSync — Subscribes to Supabase Realtime changes on workspace-scoped tables.
 * Foundation hook: components can import this to stay in sync with other users' edits.
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeSync(workspaceId: string | undefined) {
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`workspace-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          // Handle agent changes from other users
          console.log('[realtime] agents change:', payload.eventType);
          // Could trigger a refresh of the agent list
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_traces',
        },
        (payload) => {
          console.log('[realtime] new trace:', payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);
}
