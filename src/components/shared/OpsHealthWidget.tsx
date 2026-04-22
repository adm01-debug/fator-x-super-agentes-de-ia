/**
 * OpsHealthWidget — composite Ops Health card for the Dashboard.
 *
 * Mostra num cartão só o estado agregado dos 3 sinais (deploy gates,
 * orçamento, HITL) calculado por `computeOpsHealth`. Cor do cartão
 * reflete o pior sinal (ok / warn / block).
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartPulse, AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useWorkspaceId } from '@/hooks/use-data';
import { computeOpsHealth } from '@/services/opsHealth';
import { subscribeQueueChanges } from '@/services/hitlQueue';

export function OpsHealthWidget() {
  const queryClient = useQueryClient();
  const { data: workspaceId } = useWorkspaceId();

  const { data: snapshot } = useQuery({
    queryKey: ['ops_health', workspaceId],
    queryFn: () => computeOpsHealth(workspaceId ?? undefined),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    return subscribeQueueChanges(() => {
      queryClient.invalidateQueries({ queryKey: ['ops_health'] });
    });
  }, [queryClient]);

  const level = snapshot?.level ?? 'ok';
  const variant =
    level === 'block'
      ? { color: 'text-destructive', Icon: ShieldAlert }
      : level === 'warn'
        ? { color: 'text-nexus-amber', Icon: AlertTriangle }
        : { color: 'text-nexus-emerald', Icon: ShieldCheck };

  return (
    <Link to="/evals/schedule" className="block">
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className={`h-4 w-4 ${variant.color}`} />
              <p className="text-sm font-medium">Ops Health</p>
            </div>
            <variant.Icon className={`h-4 w-4 ${variant.color}`} />
          </div>
          <p className={`text-sm font-heading font-bold ${variant.color}`}>
            {snapshot?.headline ?? 'Carregando…'}
          </p>
          <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
            <span>
              gates {snapshot?.gates.gate_ok ?? 0}/{snapshot?.gates.total_agents ?? 0}
            </span>
            <span>hitl {snapshot?.hitl.total ?? 0}</span>
            <span>
              budget{' '}
              {snapshot?.budget?.configured ? `${snapshot.budget.monthly_pct.toFixed(0)}%` : 'off'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
