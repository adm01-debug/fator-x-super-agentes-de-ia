import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Minus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { AgentTrace } from '@/services/agentsService';
import {
  compareWindows,
  compareSuccessRateWindows,
  type DailyPoint,
} from './agentMetricsHelpers';
import { buildKPIInsights, type KPIInsight, type CauseTone } from './kpiInsights';
import { exportKPIInsightsCSV, exportKPIInsightsPDF } from './exportKPIInsights';

interface Props {
  daily: DailyPoint[];
  traces: AgentTrace[];
  agentName?: string;
}

const THRESHOLD_PRESETS = [1, 5, 10, 20] as const;

const WINDOW_PRESETS = [
  { value: 3, label: '3d' },
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
] as const;

type WindowValue = (typeof WINDOW_PRESETS)[number]['value'];

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

export function KPIDeepInsightsPanel({ daily, traces, agentName }: Props) {
  const [threshold, setThreshold] = useState<number>(5);
  const [windowDays, setWindowDays] = useState<WindowValue>(7);

  // How much daily history is actually available (we need 2× the window).
  const availableDays = daily.length;
  const supportedWindows = WINDOW_PRESETS.filter((w) => w.value * 2 <= availableDays);
  const effectiveWindow: WindowValue = supportedWindows.some((w) => w.value === windowDays)
    ? windowDays
    : (supportedWindows[supportedWindows.length - 1]?.value ?? WINDOW_PRESETS[0].value);

  const insights = useMemo<KPIInsight[]>(() => {
    const reqCmp = compareWindows(daily, (d) => d.requests, { window: effectiveWindow });
    const costCmp = compareWindows(daily, (d) => d.cost, { inverted: true, window: effectiveWindow });
    const latCmp = compareWindows(daily, (d) => d.avgLatency, { inverted: true, window: effectiveWindow });
    const successCmp = compareSuccessRateWindows(traces, effectiveWindow);
    return buildKPIInsights({
      daily,
      traces,
      cmps: { success: successCmp, latency: latCmp, cost: costCmp, requests: reqCmp },
      window: effectiveWindow,
    });
  }, [daily, traces, effectiveWindow]);

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

  const windowLabel = `${effectiveWindow}d vs ${effectiveWindow}d anteriores`;

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
              O que provavelmente causou o delta nos últimos {windowLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 p-1"
            role="group"
            aria-label="Janela de comparação"
          >
            <span className="text-[10px] font-semibold text-muted-foreground px-1.5 uppercase tracking-wide">
              Janela
            </span>
            {WINDOW_PRESETS.map((w) => {
              const supported = w.value * 2 <= availableDays;
              const selected = effectiveWindow === w.value;
              return (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => supported && setWindowDays(w.value)}
                  disabled={!supported}
                  aria-pressed={selected}
                  title={supported
                    ? `Comparar últimos ${w.value} dias com os ${w.value} anteriores`
                    : `Sem histórico suficiente (precisa de ${w.value * 2} dias)`}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : supported
                        ? 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        : 'text-muted-foreground/40 cursor-not-allowed'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Exportar comparativo de KPIs"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Exportar
                <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  try {
                    exportKPIInsightsPDF(insights, {
                      agentName: agentName || 'Agente',
                      windowDays: effectiveWindow,
                      threshold,
                      generatedAt: new Date(),
                    });
                    toast.success('PDF gerado com sucesso');
                  } catch (e) {
                    toast.error('Falha ao gerar PDF', { description: String(e) });
                  }
                }}
                className="gap-2 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-destructive" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Exportar como PDF</span>
                  <span className="text-[10px] text-muted-foreground">
                    Relatório completo com diagnóstico
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    exportKPIInsightsCSV(insights, {
                      agentName: agentName || 'Agente',
                      windowDays: effectiveWindow,
                      threshold,
                      generatedAt: new Date(),
                    });
                    toast.success('CSV gerado com sucesso');
                  } catch (e) {
                    toast.error('Falha ao gerar CSV', { description: String(e) });
                  }
                }}
                className="gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-nexus-emerald" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Exportar como CSV</span>
                  <span className="text-[10px] text-muted-foreground">
                    Tabela para planilha / análise
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                {i.cmp.hasPrev && (() => {
                  const unit = i.cmp.deltaUnit ?? '%';
                  const digits = unit === 'pp' ? 2 : 1;
                  return relevant ? (
                    <span className={`flex items-center gap-0.5 text-[10px] font-mono font-semibold ${deltaColor}`}>
                      <Trend className="h-3 w-3" />
                      {i.cmp.deltaPct >= 0 ? '+' : ''}{i.cmp.deltaPct.toFixed(digits)}{unit}
                    </span>
                  ) : (
                    <span
                      className="text-[10px] font-mono text-muted-foreground/70"
                      title={`Δ ${i.cmp.deltaPct >= 0 ? '+' : ''}${i.cmp.deltaPct.toFixed(digits)}${unit} < limiar ≥${threshold}${unit === 'pp' ? 'pp' : '%'}`}
                    >
                      —
                    </span>
                  );
                })()}
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
              {active.cmp.hasPrev && active.cmp.trend !== 'flat' && (() => {
                const unit = active.cmp.deltaUnit ?? '%';
                const digits = unit === 'pp' ? 2 : 1;
                return (
                  <span className="ml-1.5">
                    ({active.cmp.deltaPct >= 0 ? '+' : ''}{active.cmp.deltaPct.toFixed(digits)}{unit})
                  </span>
                );
              })()}
              <span className="ml-1.5 text-muted-foreground/70">· {windowLabel}</span>
            </p>
          </div>
        </div>

        {!active.cmp.hasPrev ? (
          <p className="text-xs text-muted-foreground italic py-3 text-center">
            Sem dados suficientes na janela anterior para diagnosticar.
          </p>
        ) : !activeRelevant ? (
          <div className="flex items-start gap-2.5 rounded-md border border-border/50 bg-secondary/30 p-3">
            <Minus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Sem mudança relevante</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Variação de{' '}
                <span className="font-mono text-foreground/80">
                  {active.cmp.deltaPct >= 0 ? '+' : ''}{active.cmp.deltaPct.toFixed(1)}%
                </span>{' '}
                está abaixo do limiar configurado de{' '}
                <span className="font-mono text-foreground/80">≥{threshold}%</span>. Ajuste o limiar acima para inspecionar deltas menores.
              </p>
            </div>
          </div>
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

        {activeRelevant && active.recommendation && (
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
