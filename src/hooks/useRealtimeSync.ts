/**
 * useRealtimeSync — Subscribes to Supabase Realtime changes on workspace-scoped tables.
 * Foundation hook: components can import this to stay in sync with other users' edits.
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

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
          logger.debug('[realtime] agents change:', payload.eventType);
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
          logger.debug('[realtime] new trace:', payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);
}
