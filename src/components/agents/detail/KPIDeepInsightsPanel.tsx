import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Lightbulb,
  Minus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { KPIInsight, CauseTone } from './kpiInsights';

interface Props {
  insights: KPIInsight[];
}

const THRESHOLD_PRESETS = [1, 5, 10, 20] as const;

const KPI_ICON: Record<KPIInsight['key'], typeof Activity> = {
  success: ShieldCheck,
  latency: Zap,
  cost: DollarSign,
  requests: Activity,
};

const TONE_STYLE: Record<CauseTone, { color: string; bg: string; border: string; Icon: typeof CheckCircle2 }> = {
  positive: { color: 'text-nexus-emerald', bg: 'bg-nexus-emerald/10', border: 'border-nexus-emerald/30', Icon: CheckCircle2 },
  negative: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: AlertTriangle },
  neutral:  { color: 'text-muted-foreground', bg: 'bg-secondary/40', border: 'border-border/40', Icon: Minus },
};

export function KPIDeepInsightsPanel({ insights }: Props) {
  const [threshold, setThreshold] = useState<number>(5);

  // Choose the most "interesting" KPI by default — biggest |delta|.
  const defaultKey =
    [...insights]
      .filter((i) => i.cmp.hasPrev)
      .sort((a, b) => Math.abs(b.cmp.deltaPct) - Math.abs(a.cmp.deltaPct))[0]?.key ?? insights[0]?.key;

  const [activeKey, setActiveKey] = useState<KPIInsight['key']>(defaultKey);
  const active = insights.find((i) => i.key === activeKey) ?? insights[0];

  if (!active) return null;

  const isRelevant = (i: KPIInsight) =>
    i.cmp.hasPrev && i.cmp.trend !== 'flat' && Math.abs(i.cmp.deltaPct) >= threshold;
  const activeRelevant = isRelevant(active);

  return (
    <div
      className="nexus-card relative overflow-hidden"
      role="region"
      aria-label="Insights detalhados por KPI"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/[0.04] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" aria-hidden />

      <div className="flex items-center justify-between gap-3 mb-4 relative flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Lightbulb className="h-3.5 w-3.5 text-primary" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-heading font-semibold text-foreground">
              Insights detalhados por KPI
            </h3>
            <p className="text-[11px] text-muted-foreground">
              O que provavelmente causou o delta nos últimos 7 dias vs 7 dias anteriores
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 p-1"
          role="group"
          aria-label="Limiar de destaque do delta percentual"
        >
          <span className="text-[10px] font-semibold text-muted-foreground px-1.5 uppercase tracking-wide">
            Limiar
          </span>
          {THRESHOLD_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setThreshold(t)}
              aria-pressed={threshold === t}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                threshold === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              ≥{t}%
            </button>
          ))}
        </div>
      </div>

      {/* KPI selector tabs */}
      <div role="tablist" aria-label="KPIs" className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {insights.map((i) => {
          const Icon = KPI_ICON[i.key];
          const active = i.key === activeKey;
          const relevant = isRelevant(i);
          const Trend = i.cmp.trend === 'up' ? TrendingUp : i.cmp.trend === 'down' ? TrendingDown : Minus;
          const deltaColor = !relevant
            ? 'text-muted-foreground'
            : i.cmp.isPositive ? 'text-nexus-emerald' : 'text-destructive';
          return (
            <button
              key={i.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveKey(i.key)}
              className={`group flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/30 hover:bg-secondary/50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Icon className={`h-3 w-3 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{i.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-heading font-extrabold text-foreground tabular-nums">
                  {i.currentLabel}
                </span>
                {i.cmp.hasPrev && (
                  relevant ? (
                    <span className={`flex items-center gap-0.5 text-[10px] font-mono font-semibold ${deltaColor}`}>
                      <Trend className="h-3 w-3" />
                      {i.cmp.deltaPct >= 0 ? '+' : ''}{i.cmp.deltaPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span
                      className="text-[10px] font-mono text-muted-foreground/70"
                      title={`Δ ${i.cmp.deltaPct >= 0 ? '+' : ''}${i.cmp.deltaPct.toFixed(1)}% < limiar ≥${threshold}%`}
                    >
                      —
                    </span>
                  )
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active KPI detail */}
      <div className="rounded-lg border border-border/50 bg-background/40 p-3.5">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <h4 className="text-xs font-heading font-semibold text-foreground">
                Diagnóstico — {active.label}
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-mono">{active.previousLabel}</span> →{' '}
              <span className="font-mono text-foreground font-semibold">{active.currentLabel}</span>
              {active.cmp.hasPrev && active.cmp.trend !== 'flat' && (
                <span className="ml-1.5">
                  ({active.cmp.deltaPct >= 0 ? '+' : ''}{active.cmp.deltaPct.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        </div>

        {!active.cmp.hasPrev ? (
          <p className="text-xs text-muted-foreground italic py-3 text-center">
            Sem dados suficientes na janela anterior para diagnosticar.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.causes.map((cause, idx) => {
              const style = TONE_STYLE[cause.tone];
              return (
                <li
                  key={idx}
                  className={`flex items-start gap-2.5 rounded-md border ${style.border} ${style.bg} p-2.5`}
                >
                  <style.Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${style.color}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${style.color}`}>{cause.headline}</p>
                    <p className="text-[11px] text-foreground/80 mt-0.5 leading-snug">{cause.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {active.recommendation && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <ChevronDown className="h-3 w-3 mt-0.5 shrink-0 -rotate-90 text-primary" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">Sugestão:</span> {active.recommendation}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
