import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, Flame, Activity, Clock, GitCompare, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useAgentSLOTargets, DEFAULT_SLO_TARGETS, type SLOTargetsConfig } from '@/hooks/useAgentSLOTargets';
import {
  buildViolationBuckets,
  computeBudgetBurn,
  computeSLO,
  filterTracesByWindow,
  formatNumber,
  type SLOMetrics,
  type DailyPoint,
} from './agentMetricsHelpers';
import type { AgentTrace } from '@/services/agentsService';
import { SLOViolationTimeline } from './SLOViolationTimeline';

type EvalWindowKey = '1h' | '6h' | '24h' | '7d' | '14d' | '30d';

const EVAL_WINDOWS: Array<{ key: EvalWindowKey; label: string; ms: number; buckets: number }> = [
  { key: '1h',  label: '1h',  ms: 60 * 60 * 1000,                buckets: 12 },
  { key: '6h',  label: '6h',  ms: 6 * 60 * 60 * 1000,            buckets: 12 },
  { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1000,           buckets: 12 },
  { key: '7d',  label: '7d',  ms: 7 * 24 * 60 * 60 * 1000,       buckets: 14 },
  { key: '14d', label: '14d', ms: 14 * 24 * 60 * 60 * 1000,      buckets: 14 },
  { key: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1000,      buckets: 15 },
];

interface Props {
  agentId: string;
  slo: SLOMetrics;
  traces: AgentTrace[];
  daily: DailyPoint[];
  onDayClick?: (day: DailyPoint) => void;
}

type Status = 'healthy' | 'warning' | 'critical';

const STATUS = {
  healthy: { color: 'text-nexus-emerald', bg: 'bg-nexus-emerald/10', border: 'border-nexus-emerald/30', Icon: CheckCircle2, label: 'Saudável' },
  warning: { color: 'text-nexus-amber', bg: 'bg-nexus-amber/10', border: 'border-nexus-amber/30', Icon: AlertTriangle, label: 'Atenção' },
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: XCircle, label: 'Crítico' },
} as const;

/**
 * Baseline mockado representando "média do setor" para comparação.
 * Valores fixos para que o usuário veja diferenças estáveis ao alternar o modo.
 */
const BASELINE_MOCK = {
  p50: 620,
  p95: 1850,
  p99: 4400,
  successRate: 99.0,
  errorRate: 1.0,
  label: 'Baseline (média do setor)',
} as const;

function latencyStatus(value: number, target: number): Status {
  if (value === 0) return 'healthy';
  if (value <= target) return 'healthy';
  if (value <= target * 1.5) return 'warning';
  return 'critical';
}

function availabilityStatus(value: number, target: number): Status {
  if (value >= target) return 'healthy';
  if (value >= target * 0.99) return 'warning';
  return 'critical';
}

export function InteractiveSLOPanel({ agentId, slo, traces, daily, onDayClick }: Props) {
  const { targets, setTargets, reset } = useAgentSLOTargets(agentId);

  const [windowKey, setWindowKey] = useState<EvalWindowKey>('14d');
  const [compareMode, setCompareMode] = useState(false);
  const activeWindow = EVAL_WINDOWS.find((w) => w.key === windowKey) ?? EVAL_WINDOWS[4];

  // Filter traces by selected evaluation window and recompute SLO from that subset.
  const windowedTraces = useMemo(
    () => filterTracesByWindow(traces, activeWindow.ms),
    [traces, activeWindow.ms],
  );
  const windowedSlo = useMemo(() => computeSLO(windowedTraces), [windowedTraces]);

  const timeline = useMemo(
    () => buildViolationBuckets(
      windowedTraces,
      { p95: targets.p95, p99: targets.p99 },
      activeWindow.ms,
      activeWindow.buckets,
    ),
    [windowedTraces, targets.p95, targets.p99, activeWindow.ms, activeWindow.buckets],
  );

  // Use windowed SLO for cards/burn so everything reflects the same window.
  const effectiveSlo = windowedTraces.length > 0 ? windowedSlo : slo;
  const burn = useMemo(() => computeBudgetBurn(effectiveSlo, targets.errorBudget), [effectiveSlo, targets.errorBudget]);

  const cards: Array<{
    key: keyof SLOTargetsConfig;
    label: string;
    value: number;
    baseline: number;
    /** true = lower is better (latency); false = higher is better (availability) */
    lowerIsBetter: boolean;
    unit: string;
    min: number;
    max: number;
    step: number;
    status: Status;
    valueFmt: (v: number) => string;
    targetFmt: (v: number) => string;
    deltaFmt: (delta: number) => string;
  }> = [
    { key: 'p50', label: 'Latência p50', value: effectiveSlo.p50, baseline: BASELINE_MOCK.p50, lowerIsBetter: true,
      unit: 'ms', min: 100, max: 3000, step: 50,
      status: latencyStatus(effectiveSlo.p50, targets.p50),
      valueFmt: (v) => `${formatNumber(Math.round(v))}ms`, targetFmt: (v) => `${formatNumber(v)}ms`,
      deltaFmt: (d) => `${d > 0 ? '+' : ''}${formatNumber(Math.round(d))}ms` },
    { key: 'p95', label: 'Latência p95', value: effectiveSlo.p95, baseline: BASELINE_MOCK.p95, lowerIsBetter: true,
      unit: 'ms', min: 500, max: 5000, step: 100,
      status: latencyStatus(effectiveSlo.p95, targets.p95),
      valueFmt: (v) => `${formatNumber(Math.round(v))}ms`, targetFmt: (v) => `${formatNumber(v)}ms`,
      deltaFmt: (d) => `${d > 0 ? '+' : ''}${formatNumber(Math.round(d))}ms` },
    { key: 'p99', label: 'Latência p99', value: effectiveSlo.p99, baseline: BASELINE_MOCK.p99, lowerIsBetter: true,
      unit: 'ms', min: 1000, max: 10000, step: 100,
      status: latencyStatus(effectiveSlo.p99, targets.p99),
      valueFmt: (v) => `${formatNumber(Math.round(v))}ms`, targetFmt: (v) => `${formatNumber(v)}ms`,
      deltaFmt: (d) => `${d > 0 ? '+' : ''}${formatNumber(Math.round(d))}ms` },
    { key: 'availability', label: 'Disponibilidade', value: effectiveSlo.successRate, baseline: BASELINE_MOCK.successRate, lowerIsBetter: false,
      unit: '%', min: 95, max: 100, step: 0.1,
      status: availabilityStatus(effectiveSlo.successRate, targets.availability),
      valueFmt: (v) => `${v.toFixed(2)}%`, targetFmt: (v) => `${v.toFixed(1)}%`,
      deltaFmt: (d) => `${d > 0 ? '+' : ''}${d.toFixed(2)} p.p.` },
  ];

  const burnStyle = STATUS[burn.status];

  return (
    <div className="nexus-card" role="region" aria-label="Painel SLO interativo">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground">Painel SLO interativo</h3>
          <p className="text-[11px] text-muted-foreground">
            Ajuste as metas com os sliders · janela:{' '}
            <span className="font-mono text-foreground">{activeWindow.label}</span> ·{' '}
            <span className="font-mono">{windowedTraces.length}</span> trace{windowedTraces.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="tablist"
            aria-label="Janela de avaliação"
            className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5"
          >
            <Clock className="h-3 w-3 text-muted-foreground ml-1.5 mr-0.5" aria-hidden />
            {EVAL_WINDOWS.map((w) => {
              const active = w.key === windowKey;
              return (
                <button
                  key={w.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setWindowKey(w.key)}
                  className={`px-2 h-6 text-[11px] font-mono rounded transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => setCompareMode((v) => !v)}
            aria-pressed={compareMode}
            aria-label="Alternar modo de comparação com baseline"
          >
            <GitCompare className="h-3 w-3" /> {compareMode ? 'Comparando' : 'Comparar baseline'}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={reset}>
            <RotateCcw className="h-3 w-3" /> Resetar metas
          </Button>
        </div>
      </div>

      {/* Cards de meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => {
          const style = STATUS[c.status];
          return (
            <div key={c.key} className={`rounded-lg border ${style.border} ${style.bg} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-foreground">{c.label}</p>
                <div className={`flex items-center gap-1 text-[10px] font-semibold ${style.color}`}>
                  <style.Icon className="h-3 w-3" />
                  {style.label}
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-xl font-heading font-extrabold text-foreground tabular-nums">
                  {c.valueFmt(c.value)}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                  alvo: {c.targetFmt(targets[c.key])}
                </span>
              </div>
              {compareMode && (
                <BaselineDelta
                  value={c.value}
                  baseline={c.baseline}
                  lowerIsBetter={c.lowerIsBetter}
                  valueFmt={c.valueFmt}
                  deltaFmt={c.deltaFmt}
                />
              )}
              <Slider
                value={[targets[c.key]]}
                min={c.min}
                max={c.max}
                step={c.step}
                onValueChange={(v) => setTargets({ [c.key]: v[0] } as Partial<SLOTargetsConfig>)}
                aria-label={`Meta ${c.label}`}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                <span>{c.targetFmt(c.min)}</span>
                <span>{c.targetFmt(c.max)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error budget burn */}
      <div className={`mt-3 rounded-lg border ${burnStyle.border} ${burnStyle.bg} p-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className={`h-3.5 w-3.5 ${burnStyle.color}`} />
            <p className="text-xs font-medium text-foreground">Error budget burn</p>
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-semibold ${burnStyle.color}`}>
            <burnStyle.Icon className="h-3 w-3" />
            {burnStyle.label}
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xl font-heading font-extrabold text-foreground tabular-nums">
            {burn.consumedPct.toFixed(0)}%
          </span>
          <span className="text-[11px] text-muted-foreground">do budget consumido</span>
          <span className="text-[10px] text-muted-foreground ml-auto font-mono">
            {effectiveSlo.errorRate.toFixed(2)}% / {targets.errorBudget.toFixed(1)}%
          </span>
        </div>
        {compareMode && (
          <BaselineDelta
            value={effectiveSlo.errorRate}
            baseline={BASELINE_MOCK.errorRate}
            lowerIsBetter={true}
            valueFmt={(v) => `${v.toFixed(2)}%`}
            deltaFmt={(d) => `${d > 0 ? '+' : ''}${d.toFixed(2)} p.p.`}
            label="Taxa de erro vs baseline"
          />
        )}
        <div className="h-2 bg-secondary/60 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full transition-all ${burn.status === 'critical' ? 'bg-destructive' : burn.status === 'warning' ? 'bg-nexus-amber' : 'bg-nexus-emerald'}`}
            style={{ width: `${Math.min(100, burn.consumedPct)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
          <span>
            {burn.daysToExhaustion === null
              ? 'Sem dados suficientes para previsão'
              : burn.daysToExhaustion <= 0
              ? 'Budget já esgotado neste período'
              : `Em ritmo de exaustão em ~${burn.daysToExhaustion} dia${burn.daysToExhaustion !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
            <span>Meta de erro permitida</span>
            <span className="font-mono">{targets.errorBudget.toFixed(1)}%</span>
          </div>
          <Slider
            value={[targets.errorBudget]}
            min={0.1}
            max={5}
            step={0.1}
            onValueChange={(v) => setTargets({ errorBudget: v[0] })}
            aria-label="Error budget mensal permitido"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-heading font-semibold text-foreground">
              Timeline de violações ({activeWindow.label})
            </h4>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {activeWindow.buckets} bucket{activeWindow.buckets !== 1 ? 's' : ''} · hover para detalhes
          </span>
        </div>
        {windowedTraces.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sem traces na janela de {activeWindow.label}
          </p>
        ) : (
          <SLOViolationTimeline data={timeline} daily={daily} onDayClick={onDayClick} />
        )}
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
          <LegendDot color="bg-nexus-emerald" label="Saudável" />
          <LegendDot color="bg-nexus-amber" label="Acima de p95" />
          <LegendDot color="bg-destructive" label="Acima de p99 / erro" />
          <span className="ml-auto font-mono">
            Defaults: p50 {DEFAULT_SLO_TARGETS.p50}ms · p95 {DEFAULT_SLO_TARGETS.p95}ms · p99 {DEFAULT_SLO_TARGETS.p99}ms · {DEFAULT_SLO_TARGETS.availability}%
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
