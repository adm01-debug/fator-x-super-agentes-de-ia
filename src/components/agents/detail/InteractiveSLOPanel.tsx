import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, Flame, Activity, Clock, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { SLOViolationTimeline, type ViolationKind } from './SLOViolationTimeline';
import { ViolationDrillDownDialog } from './ViolationDrillDownDialog';
import type { ViolationDay } from './agentMetricsHelpers';
import { generateSLOReportPdf } from './sloReportPdf';
import { buildTimelineCsv, downloadCsv } from './sloTimelineCsv';
import { toast } from 'sonner';

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
  agentName?: string;
  slo: SLOMetrics;
  traces: AgentTrace[];
  daily: DailyPoint[];
  onDayClick?: (day: DailyPoint) => void;
  /** When true, renders skeletons in place of the timeline strip. */
  loading?: boolean;
}

type Status = 'healthy' | 'warning' | 'critical';

const STATUS = {
  healthy: { color: 'text-nexus-emerald', bg: 'bg-nexus-emerald/10', border: 'border-nexus-emerald/30', Icon: CheckCircle2, label: 'Saudável' },
  warning: { color: 'text-nexus-amber', bg: 'bg-nexus-amber/10', border: 'border-nexus-amber/30', Icon: AlertTriangle, label: 'Atenção' },
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: XCircle, label: 'Crítico' },
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

export function InteractiveSLOPanel({ agentId, agentName, slo, traces, daily, onDayClick, loading = false }: Props) {
  const { targets, setTargets, reset } = useAgentSLOTargets(agentId);

  const [windowKey, setWindowKey] = useState<EvalWindowKey>('14d');
  const activeWindow = EVAL_WINDOWS.find((w) => w.key === windowKey) ?? EVAL_WINDOWS[4];
  const bucketMs = activeWindow.ms / activeWindow.buckets;

  const [drillBucket, setDrillBucket] = useState<ViolationDay | null>(null);
  const [drillKind, setDrillKind] = useState<ViolationKind>('p95');

  const handleViolationClick = (bucket: ViolationDay, kind: ViolationKind) => {
    setDrillBucket(bucket);
    setDrillKind(kind);
  };

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
    unit: string;
    min: number;
    max: number;
    step: number;
    status: Status;
    valueFmt: (v: number) => string;
    targetFmt: (v: number) => string;
  }> = [
    { key: 'p50', label: 'Latência p50', value: effectiveSlo.p50, unit: 'ms', min: 100, max: 3000, step: 50,
      status: latencyStatus(effectiveSlo.p50, targets.p50),
      valueFmt: (v) => `${formatNumber(Math.round(v))}ms`, targetFmt: (v) => `${formatNumber(v)}ms` },
    { key: 'p95', label: 'Latência p95', value: effectiveSlo.p95, unit: 'ms', min: 500, max: 5000, step: 100,
      status: latencyStatus(effectiveSlo.p95, targets.p95),
      valueFmt: (v) => `${formatNumber(Math.round(v))}ms`, targetFmt: (v) => `${formatNumber(v)}ms` },
    { key: 'p99', label: 'Latência p99', value: effectiveSlo.p99, unit: 'ms', min: 1000, max: 10000, step: 100,
      status: latencyStatus(effectiveSlo.p99, targets.p99),
      valueFmt: (v) => `${formatNumber(Math.round(v))}ms`, targetFmt: (v) => `${formatNumber(v)}ms` },
    { key: 'availability', label: 'Disponibilidade', value: effectiveSlo.successRate, unit: '%', min: 95, max: 100, step: 0.1,
      status: availabilityStatus(effectiveSlo.successRate, targets.availability),
      valueFmt: (v) => `${v.toFixed(2)}%`, targetFmt: (v) => `${v.toFixed(1)}%` },
  ];

  const burnStyle = STATUS[burn.status];

  const safeAgentSlug = (agentName || 'agente').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleExportPdf = () => {
    try {
      const doc = generateSLOReportPdf({
        agentName: agentName || 'Agente',
        windowLabel: activeWindow.label,
        windowTraces: windowedTraces.length,
        generatedAt: new Date(),
        slo: effectiveSlo,
        targets,
        burn,
        timeline,
        daily,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`relatorio-slo-${safeAgentSlug}-${activeWindow.label}-${stamp}.pdf`);
      toast.success('Relatório SLO exportado', {
        description: `Janela ${activeWindow.label} · ${windowedTraces.length} traces`,
      });
    } catch (e) {
      console.error('Erro ao gerar relatório SLO:', e);
      toast.error('Falha ao gerar o relatório PDF');
    }
  };

  const handleExportCsv = () => {
    try {
      if (timeline.length === 0) {
        toast.warning('Nada a exportar', { description: 'Sem buckets na janela atual.' });
        return;
      }
      const csv = buildTimelineCsv(timeline, bucketMs, {
        agentName: agentName || 'Agente',
        windowLabel: activeWindow.label,
        generatedAt: new Date(),
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`timeline-slo-${safeAgentSlug}-${activeWindow.label}-${stamp}.csv`, csv);
      toast.success('Timeline exportada em CSV', {
        description: `${timeline.length} buckets · janela ${activeWindow.label}`,
      });
    } catch (e) {
      console.error('Erro ao gerar CSV da timeline:', e);
      toast.error('Falha ao gerar o CSV');
    }
  };


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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                aria-label="Exportar timeline e classificações de violação"
              >
                <Download className="h-3 w-3" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Janela {activeWindow.label} · {timeline.length} bucket{timeline.length !== 1 ? 's' : ''}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleExportCsv} className="gap-2 text-xs cursor-pointer">
                <FileSpreadsheet className="h-3.5 w-3.5 text-nexus-emerald" />
                <div className="flex flex-col">
                  <span>Baixar CSV</span>
                  <span className="text-[10px] text-muted-foreground">Buckets e classificações</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportPdf} className="gap-2 text-xs cursor-pointer">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <div className="flex flex-col">
                  <span>Baixar PDF</span>
                  <span className="text-[10px] text-muted-foreground">Relatório completo SLO</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            {activeWindow.buckets} bucket{activeWindow.buckets !== 1 ? 's' : ''}
            <span className="hidden sm:inline"> · hover para detalhes</span>
            <span className="sm:hidden"> · toque p/ detalhes</span>
          </span>
        </div>
        {windowedTraces.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sem traces na janela de {activeWindow.label}
          </p>
        ) : (
          <SLOViolationTimeline
            data={timeline}
            daily={daily}
            onDayClick={onDayClick}
            onViolationClick={handleViolationClick}
          />
        )}
        <div className="flex items-center gap-x-3 gap-y-1.5 mt-3 text-[10px] text-muted-foreground flex-wrap">
          <LegendDot color="bg-nexus-emerald" label="Saudável" />
          <LegendDot color="bg-nexus-amber" label="Acima de p95" />
          <LegendDot color="bg-destructive" label="Acima de p99 / erro" />
          <span className="font-mono w-full sm:w-auto sm:ml-auto sm:text-right">
            <span className="hidden sm:inline">Defaults: </span>
            p50 {DEFAULT_SLO_TARGETS.p50}ms · p95 {DEFAULT_SLO_TARGETS.p95}ms · p99 {DEFAULT_SLO_TARGETS.p99}ms · {DEFAULT_SLO_TARGETS.availability}%
          </span>
        </div>
      </div>

      <ViolationDrillDownDialog
        open={drillBucket !== null}
        onOpenChange={(o) => { if (!o) setDrillBucket(null); }}
        bucket={drillBucket}
        traces={windowedTraces}
        bucketMs={bucketMs}
        windowLabel={activeWindow.label}
        targets={{ p95: targets.p95, p99: targets.p99 }}
        initialKind={drillKind}
      />
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
