/**
 * HitlQueueWidget — compact dashboard card with realtime HITL pendencies.
 *
 * Lê `public.workflow_runs where status = 'awaiting_approval'` via
 * `hitlQueue.getQueueStats` e re-renderiza quando a fila muda.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCheck, AlertTriangle, ArrowRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { getQueueStats, subscribeQueueChanges } from '@/services/hitlQueue';

export function HitlQueueWidget() {
  const queryClient = useQueryClient();
  const { data: stats } = useQuery({
    queryKey: ['hitl_queue_stats'],
    queryFn: getQueueStats,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    return subscribeQueueChanges(() => {
      queryClient.invalidateQueries({ queryKey: ['hitl_queue_stats'] });
      queryClient.invalidateQueries({ queryKey: ['hitl_pending'] });
    });
  }, [queryClient]);

  const total = stats?.total ?? 0;
  const overSla = stats?.over_sla ?? 0;
  const oldest = stats?.oldest_age_minutes ?? null;

  const color =
    overSla > 0 ? 'text-destructive' : total > 0 ? 'text-nexus-amber' : 'text-nexus-emerald';

  return (
    <Link to="/approvals" className="block">
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {overSla > 0 ? (
                <AlertTriangle className={`h-4 w-4 ${color}`} />
              ) : (
                <UserCheck className={`h-4 w-4 ${color}`} />
              )}
              <p className="text-sm font-medium">Aprovações pendentes</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={`text-2xl font-heading font-bold ${color}`}>{total}</p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{oldest !== null ? `Mais antigo: ${oldest} min` : 'Sem pendências'}</span>
            {overSla > 0 && (
              <span className="text-destructive font-semibold">{overSla} fora do SLA</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
