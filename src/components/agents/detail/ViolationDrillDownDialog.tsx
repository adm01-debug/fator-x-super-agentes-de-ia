import { useMemo, useState } from 'react';
import { AlertTriangle, XCircle, Zap, Activity, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LightLineChart } from '@/components/charts';
import { percentile, formatCost, formatNumber, type ViolationDay } from './agentMetricsHelpers';
import type { AgentTrace } from '@/services/agentsService';

type ViolationKind = 'p95' | 'p99' | 'error';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: ViolationDay | null;
  traces: AgentTrace[];
  bucketMs: number;
  windowLabel: string;
  targets: { p95: number; p99: number };
  initialKind?: ViolationKind;
}

const KIND_META: Record<ViolationKind, { label: string; color: string; bg: string; border: string; Icon: typeof Zap; description: string }> = {
  p95: {
    label: 'Latência > p95',
    color: 'text-nexus-amber',
    bg: 'bg-nexus-amber/10',
    border: 'border-nexus-amber/30',
    Icon: Zap,
    description: 'Traces com latência acima do alvo p95 mas dentro do p99.',
  },
  p99: {
    label: 'Latência > p99',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    Icon: AlertTriangle,
    description: 'Traces com latência acima do alvo p99 — outliers críticos.',
  },
  error: {
    label: 'Erros / Critical',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    Icon: XCircle,
    description: 'Traces com level=error ou level=critical neste período.',
  },
};

function formatBucketRange(iso: string, windowMs: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + windowMs);
  const useTime = windowMs <= 24 * 60 * 60 * 1000;
  if (useTime) {
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${fmt(start)} → ${fmt(end)}`;
  }
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(start)} → ${fmt(end)}`;
}

export function ViolationDrillDownDialog({
  open,
  onOpenChange,
  bucket,
  traces,
  bucketMs,
  windowLabel,
  targets,
  initialKind = 'p95',
}: Props) {
  const [kind, setKind] = useState<ViolationKind>(initialKind);

  // Filter traces inside the bucket time range.
  const bucketTraces = useMemo(() => {
    if (!bucket) return [];
    const start = new Date(bucket.date).getTime();
    const end = start + bucketMs;
    return traces.filter((t) => {
      const ts = new Date(t.created_at).getTime();
      return ts >= start && ts < end;
    });
  }, [bucket, bucketMs, traces]);

  const violationsByKind = useMemo(() => {
    const p95: AgentTrace[] = [];
    const p99: AgentTrace[] = [];
    const errors: AgentTrace[] = [];
    for (const t of bucketTraces) {
      const lat = Number(t.latency_ms ?? 0);
      const isErr = t.level === 'error' || t.level === 'critical';
      if (isErr) errors.push(t);
      if (lat > targets.p99) p99.push(t);
      else if (lat > targets.p95) p95.push(t);
    }
    return { p95, p99, error: errors };
  }, [bucketTraces, targets.p95, targets.p99]);

  const filtered = violationsByKind[kind];

  // Build mini latency-over-time chart for the bucket.
  const latencyChart = useMemo(() => {
    if (!bucket || bucketTraces.length === 0) return [];
    // Subdivide the bucket into 12 mini-buckets for the line chart.
    const sub = 12;
    const start = new Date(bucket.date).getTime();
    const sliceMs = bucketMs / sub;
    const out: Array<{ time: string; p95: number; max: number; target_p95: number; target_p99: number }> = [];
    for (let i = 0; i < sub; i++) {
      const sStart = start + i * sliceMs;
      const sEnd = sStart + sliceMs;
      const lats = bucketTraces
        .filter((t) => {
          const ts = new Date(t.created_at).getTime();
          return ts >= sStart && ts < sEnd;
        })
        .map((t) => Number(t.latency_ms ?? 0))
        .filter((n) => n > 0);
      const d = new Date(sStart);
      const useTime = bucketMs <= 24 * 60 * 60 * 1000;
      const label = useTime
        ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({
        time: label,
        p95: lats.length > 0 ? Math.round(percentile(lats, 95)) : 0,
        max: lats.length > 0 ? Math.max(...lats) : 0,
        target_p95: targets.p95,
        target_p99: targets.p99,
      });
    }
    return out;
  }, [bucket, bucketMs, bucketTraces, targets.p95, targets.p99]);

  // Aggregate stats for the filtered set.
  const stats = useMemo(() => {
    if (filtered.length === 0) {
      return { count: 0, p50: 0, p95: 0, p99: 0, avg: 0, totalCost: 0, totalTokens: 0 };
    }
    const lats = filtered.map((t) => Number(t.latency_ms ?? 0)).filter((n) => n > 0);
    const totalCost = filtered.reduce((s, t) => s + Number(t.cost_usd ?? 0), 0);
    const totalTokens = filtered.reduce((s, t) => s + Number(t.tokens_used ?? 0), 0);
    return {
      count: filtered.length,
      p50: lats.length ? Math.round(percentile(lats, 50)) : 0,
      p95: lats.length ? Math.round(percentile(lats, 95)) : 0,
      p99: lats.length ? Math.round(percentile(lats, 99)) : 0,
      avg: lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0,
      totalCost,
      totalTokens,
    };
  }, [filtered]);

  // Top events by frequency among filtered violations.
  const topEvents = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filtered) {
      const k = t.event || '(sem evento)';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filtered]);

  const maxEventCount = topEvents.length ? topEvents[0][1] : 0;

  if (!bucket) return null;

  const meta = KIND_META[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b border-border/50">
          <DialogTitle className="font-heading text-lg flex items-center gap-2">
            <meta.Icon className={`h-4 w-4 ${meta.color}`} />
            Drill-down de violações
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{formatBucketRange(bucket.date, bucketMs)}</span>
            <span>·</span>
            <span>janela de avaliação {windowLabel}</span>
          </DialogDescription>

          {/* Kind tabs */}
          <div role="tablist" aria-label="Tipo de violação" className="grid grid-cols-3 gap-2 mt-3">
            {(Object.keys(KIND_META) as ViolationKind[]).map((k) => {
              const m = KIND_META[k];
              const count = violationsByKind[k].length;
              const active = k === kind;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setKind(k)}
                  className={`group relative flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? `${m.border} ${m.bg}`
                      : 'border-border bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <m.Icon className={`h-3 w-3 ${m.color}`} />
                    <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{m.label}</span>
                  </div>
                  <span className={`text-xl font-heading font-extrabold tabular-nums ${active ? m.color : 'text-foreground'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Description + summary stats */}
            <div className={`rounded-lg border ${meta.border} ${meta.bg} p-3`}>
              <p className="text-xs text-foreground mb-3">{meta.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Violações" value={formatNumber(stats.count)} accent={meta.color} />
                {kind === 'error' ? (
                  <>
                    <Stat label="Custo total" value={formatCost(stats.totalCost)} />
                    <Stat label="Tokens" value={formatNumber(stats.totalTokens)} />
                    <Stat label="Lat. média" value={stats.avg > 0 ? `${stats.avg}ms` : '—'} />
                  </>
                ) : (
                  <>
                    <Stat label="p50" value={`${stats.p50}ms`} />
                    <Stat label="p95" value={`${stats.p95}ms`} />
                    <Stat label="máx." value={`${stats.p99}ms`} />
                  </>
                )}
              </div>
            </div>

            {/* Latency chart */}
            <section>
              <h4 className="text-xs font-heading font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                Latência durante o bucket
              </h4>
              {latencyChart.length === 0 || bucketTraces.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-6 text-center">
                  Sem dados de latência neste período.
                </p>
              ) : (
                <div className="rounded-lg border border-border/50 bg-secondary/20 p-2">
                  <LightLineChart
                    data={latencyChart}
                    xKey="time"
                    height={200}
                    yFormatter={(v) => `${v}ms`}
                    tooltipFormatter={(v, name) => `${v}ms · ${name}`}
                    series={[
                      { dataKey: 'max', name: 'Máx.', stroke: 'hsl(var(--destructive))', strokeWidth: 1.5, dotRadius: 2 },
                      { dataKey: 'p95', name: 'p95 observado', stroke: 'hsl(var(--primary))', strokeWidth: 2, dotRadius: 3 },
                      { dataKey: 'target_p95', name: 'Alvo p95', stroke: 'hsl(var(--nexus-amber))', strokeWidth: 1, strokeDasharray: '4 4', dotRadius: 0 },
                      { dataKey: 'target_p99', name: 'Alvo p99', stroke: 'hsl(var(--destructive))', strokeWidth: 1, strokeDasharray: '4 4', dotRadius: 0 },
                    ]}
                  />
                </div>
              )}
            </section>

            {/* Top events */}
            <section>
              <h4 className="text-xs font-heading font-semibold text-foreground mb-2">
                Eventos mais afetados
              </h4>
              {topEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  Sem violações desse tipo neste bucket.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {topEvents.map(([evt, count]) => {
                    const pct = maxEventCount > 0 ? (count / maxEventCount) * 100 : 0;
                    return (
                      <div key={evt} className="space-y-1">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-mono text-foreground truncate">{evt}</span>
                          <span className="font-semibold tabular-nums text-foreground shrink-0">{count}×</span>
                        </div>
                        <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${kind === 'p95' ? 'bg-nexus-amber' : 'bg-destructive'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Trace list */}
            <section>
              <h4 className="text-xs font-heading font-semibold text-foreground mb-2">
                Traces com violação
                <span className="text-muted-foreground font-normal ml-1">({filtered.length})</span>
              </h4>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  Nenhum trace correspondente.
                </p>
              ) : (
                <div className="rounded-lg border border-border/50 divide-y divide-border/40">
                  {filtered.slice(0, 30).map((t, idx) => {
                    const time = new Date(t.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    const lat = Number(t.latency_ms ?? 0);
                    const overP99 = lat > targets.p99;
                    const latColor = overP99 ? 'text-destructive' : lat > targets.p95 ? 'text-nexus-amber' : 'text-foreground';
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-secondary/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-muted-foreground tabular-nums shrink-0">{time}</span>
                          <span className="text-foreground truncate">{t.event || '(sem evento)'}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 tabular-nums">
                          {lat > 0 && <span className={`font-semibold ${latColor}`}>{lat}ms</span>}
                          {typeof t.cost_usd === 'number' && t.cost_usd > 0 && (
                            <span className="text-muted-foreground">{formatCost(t.cost_usd)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length > 30 && (
                    <div className="text-[11px] text-muted-foreground text-center py-2">
                      + {filtered.length - 30} traces adicionais
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md bg-background/60 border border-border/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono font-semibold text-sm ${accent ?? 'text-foreground'}`}>{value}</div>
    </div>
  );
}
