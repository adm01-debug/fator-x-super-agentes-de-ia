/**
 * Sprint 33 — Realtime mount: toast on new incident runs.
 */
import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { logger } from '@/lib/logger';

export function IncidentRunsMounter() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('incident-runs-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incident_runs' },
        (payload) => {
          const run = payload.new as { id: string; triggered_by?: string };
          toast('🚨 Playbook disparado', {
            description: `Origem: ${run.triggered_by ?? 'sistema'}`,
            action: {
              label: 'Ver',
              onClick: () => {
                window.location.href = '/observability/playbooks';
              },
            },
          });
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') logger.error('incident runs channel error');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
