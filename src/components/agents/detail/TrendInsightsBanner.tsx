import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import type { KPIComparison } from './agentMetricsHelpers';

interface InsightInput {
  key: string;
  label: string;
  cmp: KPIComparison;
  format: (v: number) => string;
  /** prioridade quando |delta| empata; menor = mais importante */
  priority: number;
}

interface Props {
  insights: InsightInput[];
}

export function TrendInsightsBanner({ insights }: Props) {
  const valid = insights.filter((i) => i.cmp.hasPrev);
  if (valid.length === 0) return null;

  const relevant = valid
    .filter((i) => i.cmp.trend !== 'flat')
    .sort((a, b) => {
      const diff = Math.abs(b.cmp.deltaPct) - Math.abs(a.cmp.deltaPct);
      if (Math.abs(diff) > 0.5) return diff;
      return a.priority - b.priority;
    })
    .slice(0, 3);

  return (
    <div
      role="status"
      aria-label="Insights de tendência (últimos 7 dias vs 7 dias anteriores)"
      className="nexus-card border-primary/15 bg-gradient-to-r from-card via-card to-primary/[0.04] relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.03] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" aria-hidden="true" />
      <div className="flex items-center gap-2 mb-3 relative">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-heading font-semibold text-foreground">
          Tendência: últimos 7 dias vs 7 dias anteriores
        </h3>
      </div>

      {relevant.length === 0 ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          Métricas estáveis nos últimos 7 dias vs 7 dias anteriores.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {relevant.map((i) => {
            const { cmp } = i;
            const Icon = cmp.trend === 'up' ? TrendingUp : TrendingDown;
            const color = cmp.isPositive ? 'text-nexus-emerald' : 'text-destructive';
            const arrow = cmp.trend === 'up' ? '↗' : '↘';
            const direction = cmp.trend === 'up' ? 'cresceu' : 'caiu';
            const judgment = cmp.isPositive ? 'positivo' : cmp.inverted && cmp.trend === 'up' ? 'precisa atenção' : 'precisa atenção';
            return (
              <li key={i.key} className="flex items-start gap-2 text-xs">
                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
                <p className="text-muted-foreground">
                  <span className={`font-semibold ${color}`}>
                    {arrow} {i.label} {direction} {cmp.deltaPct >= 0 ? '+' : ''}
                    {cmp.deltaPct.toFixed(1)}%
                  </span>{' '}
                  <span className="text-foreground/80">
                    ({i.format(cmp.previous)} → {i.format(cmp.current)})
                  </span>{' '}
                  <span className="text-muted-foreground/70">— {judgment}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
