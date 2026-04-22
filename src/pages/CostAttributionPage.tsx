/**
 * Cost Attribution Page — `/billing/attribution`
 *
 * Dashboard read-only que mostra o Top-N agentes mais caros no período
 * selecionado. Usa `computeAttribution` de `src/services/costAttribution.ts`
 * para somar eval + prod por agente.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Clock } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  computeAttribution,
  lastNDays,
  startOfMonth,
  topN,
  type AttributionWindow,
} from '@/services/costAttribution';

type Range = 'month' | 'last7' | 'last30';

export default function CostAttributionPage() {
  const [range, setRange] = useState<Range>('month');

  const window: AttributionWindow = useMemo(() => {
    if (range === 'last7') return lastNDays(7);
    if (range === 'last30') return lastNDays(30);
    return startOfMonth();
  }, [range]);

  const { data, isLoading } = useQuery({
    queryKey: ['cost_attribution', range],
    queryFn: () => computeAttribution(window),
  });

  const top10 = useMemo(() => (data ? topN(data, 10) : []), [data]);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Cost Attribution"
        description="Gasto acumulado por agente (eval + produção) no período selecionado."
        actions={
          <div className="flex gap-2">
            <RangeButton label="Mês atual" value="month" current={range} setCurrent={setRange} />
            <RangeButton label="Últimos 7d" value="last7" current={range} setCurrent={setRange} />
            <RangeButton label="Últimos 30d" value="last30" current={range} setCurrent={setRange} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Gasto total"
          value={`US$ ${(data?.total_usd ?? 0).toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Agentes ativos"
          value={data?.by_agent.length ?? 0}
          icon={<TrendingUp className="h-4 w-4 text-nexus-emerald" />}
        />
        <StatCard
          label="Top 1 (share)"
          value={top10[0] ? `${top10[0].share_pct.toFixed(0)}%` : '—'}
          icon={<TrendingUp className="h-4 w-4 text-nexus-amber" />}
        />
        <StatCard
          label="Janela"
          value={rangeLabel(range)}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Calculando atribuição…</p>
      ) : top10.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum gasto registrado neste período.
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-heading font-semibold text-foreground">Top 10 agentes</h2>
          <ul className="space-y-2">
            {top10.map((a, i) => (
              <li
                key={a.agent_id}
                className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0"
              >
                <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.agent_name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    {a.agent_id}
                  </p>
                </div>
                <div className="text-right min-w-[140px]">
                  <p className="text-sm font-bold text-foreground">US$ {a.total_usd.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    eval ${a.eval_cost_usd.toFixed(2)} · prod ${a.prod_cost_usd.toFixed(2)}
                  </p>
                </div>
                <div className="min-w-[100px]">
                  <Progress value={a.share_pct} className="h-2" />
                  <p className="text-[11px] text-muted-foreground text-right mt-0.5">
                    {a.share_pct.toFixed(1)}%
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function RangeButton({
  label,
  value,
  current,
  setCurrent,
}: {
  label: string;
  value: Range;
  current: Range;
  setCurrent: (v: Range) => void;
}) {
  const active = current === value;
  return (
    <Button
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={() => setCurrent(value)}
      className="text-xs"
    >
      {label}
    </Button>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="nexus-card text-center py-3">
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}</div>
      <p className="text-xl font-heading font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function rangeLabel(r: Range): string {
  if (r === 'last7') return '7 dias';
  if (r === 'last30') return '30 dias';
  return 'mês';
}
